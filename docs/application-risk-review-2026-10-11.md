# Revbaze application risk review

Reviewed October 11, 2026. Scope: frontend routes/authentication, workspace persistence, onboarding, review cards/platforms, public review pages, analytics, uploads, integrations, members/invitations, Stripe billing, Supabase migrations/Edge Functions, deployment configuration, and automated tests.

This is a source review with local tests, not a production penetration test or load test. No live database, deployment, billing settings, or provider logs were accessed. Existing application code was not changed by this review. Production Auth settings, applied migrations, WAF rules, backups, budgets, and secrets cannot be established from source alone.

## Implementation follow-up

Source changes now address tracking tokens/limits, bounded server-side analytics and exact unique counts, metadata-only Realtime, resized/validated managed uploads, quota reservations, and reference-safe cleanup. Deployment instructions are in `supabase/HARDENING.md`. Full migration replay and additional hardening tests were added, and the recovery/Realtime harness failures were repaired. The findings below describe the pre-hardening implementation; production deployment and hosted verification remain outstanding. Distributed bot resistance, provider spend controls, raw-data retention and the other operational findings still require attention.

## Overall assessment

The authorization design has useful foundations. The principal observed risks are abuse of public tracking, repeated high-volume analytics reads, unlimited accumulation of uploaded files and events, and unlimited paid-plan resource consumption. Prioritize these before increasing public traffic. No confirmed cross-tenant authorization bypass or payment-entitlement forgery was identified in the paths reviewed; this does not establish their absence in production.

## Existing protections

- Workspace tables enable RLS; browser-direct writes are revoked. Mutation functions check business access and sensitive role permissions.
- Public pages receive an explicit published-card projection, with publication, active destination, and current entitlement checks.
- Database constraints and validation enforce HTTPS destinations and official platform domains; custom destinations intentionally allow other public HTTPS domains.
- Plan quotas use server triggers and transaction locks; private account plans are not browser-writable.
- Stripe webhooks verify untouched-body HMAC signatures and a timestamp window. Reconciliation reads current Stripe subscription/payment state and uses database leases/idempotency.
- Member invitations validate the authenticated actor and verified recipient, limit seats, and restrict reservation RPCs to service_role.
- Contact messages use bounded stream reading, a honeypot, and database email/source limits.
- Analytics CSV exports escape quotes and neutralize common formula prefixes. React renders customer text without a found dangerouslySetInnerHTML sink.
- Uploaded file types exclude SVG; ownership/folder upload policies are present. Account changes clear cached data.

## Findings, ranked

### R1 — High: public tracking can be forged and exhausted

Evidence: `supabase/functions/review-events/index.ts`; `src/services/reviewEvents.ts`; `supabase/migrations/202610080001_review_link_management.sql:208`.

The endpoint accepts anonymous requests for a published slug with browser-supplied event and visitor UUIDs. Published-card validation proves that a card exists, not that a human visited or clicked it. There is no application per-caller limiter or signed page session. The only ingestion cap is shared by every visitor to a card: 120 events/minute. An attacker can generate fresh IDs, inflate metrics, consume that allowance, and cause legitimate analytics to be rejected. Requests still execute publication checks and possibly business lookup before reaching the cap.

Mitigation: protect the actual Supabase ingress with caller/card/global rate limits before expensive work, short-lived signed page sessions, anomaly detection, and bounded retries. A signed session raises the cost of forgery but is not proof of a human. Retain an appropriately sized per-card backstop; monitor rejected real traffic. Restricting CORS alone is not bot protection.

### R2 — High: analytics reads grow with visitor history

Evidence: `src/services/workspace.ts:65`; migrations `202610090009_edit_review_platform.sql` and `202610090012_analytics_timezones.sql`.

Workspace loading downloads every returned analytics page in chunks of 1,000. Queries group by visitor_key, day, card, event type, destination, source, and referrer. For many distinct visitors, returned rows remain close to raw event volume. UI date/card/platform filtering happens after downloading history. Offset pagination does not eliminate grouping/sorting work; actual query-plan cost must be measured. Per-row plan-access helper calls can add further work. The event card/date index exists, so this is not simply an absent-index problem.

Mitigation: accept date/filter bounds in authorized RPCs, compute chart totals server-side, separate visitor-detail queries from dashboard summaries, use daily rollups, and use bounded/keyset pagination where detail is required. Measure EXPLAIN ANALYZE on representative datasets before choosing indexes or larger compute.

### R3 — High: Realtime multiplies full workspace reloads

Evidence: `src/hooks/useLiveWorkspace.ts:24`; `src/services/workspace.ts:113`.

Event INSERT notifications invalidate the workspace after a 250ms throttle. Each refresh loads links, cards, activity, and all authorized analytics. Under sustained events, active tabs can repeatedly reload the same large history. More subscribers multiply work. Supabase documents per-subscriber authorization and ordered single-thread processing for Postgres Changes.

Mitigation: refresh only small summaries on a controlled interval, apply incremental updates, or broadcast compact summary changes. Avoid invalidating an entire workspace per event. Suspend unnecessary subscriptions when hidden and observe query frequency per active dashboard.

Reference: https://supabase.com/docs/guides/realtime/postgres-changes

### R4 — High: uploads have no cumulative quota or lifecycle cleanup

Evidence: `src/services/workspace.ts:270`; migration `202610080003_onboarding_templates_assets.sql:2`; upload policies in migration `202610080001_review_link_management.sql:227`.

Both image buckets allow files just under 10 MiB. Cloud uploads send the original file, use a fresh UUID path, and do not remove previous files when an image is replaced. Storage policies restrict ownership but not cumulative bytes or upload frequency. A signed-in user can upload many images directly through the Storage API, including profile images, bypassing frontend checks. Public display serves the original asset without an application resizing pipeline.

Mitigation: reserve per-account storage quotas server-side, enforce upload frequency/bytes, resize/re-encode logos and avatars, validate image contents, remove unreferenced objects after a grace period, and meter storage/egress. Frontend compression alone cannot enforce abuse limits.

### R5 — High business-cost risk: unlimited Pro resources

Evidence: `src/lib/plans.ts`; quota triggers in migrations `202610090004_plan_access.sql` and `202610090011_free_overview_access.sql`.

Pro costs $29/month in application pricing and has no business or card count limit. Paid plans have no cumulative platform-link quota in the reviewed database logic. Neither paid nor Free plans have event-volume or upload-byte quotas. A heavy tenant can cost disproportionately more than subscription revenue; Free traffic also consumes resources.

Mitigation: define fair-use limits and enforced storage/traffic allowances, measure cost by tenant, and introduce high-volume pricing or explicit agreements. Limit abuse through server-side quotas without silently changing advertised customer entitlements.

### R6 — Medium: raw data grows indefinitely

Evidence: event/activity inserts in migration `202610080001_review_link_management.sql`; contact migration `202610090014_contact_messages.sql`; `supabase/LEGAL_REVIEW.md`.

Analytics access windows are read restrictions, not deletion jobs. There is no found scheduled event/activity/contact/draft/file retention worker. Each outbound click also creates business activity, although dashboards only request the latest 100 activity records. Storage, indexes, backups, and maintenance therefore grow over time.

Mitigation: define actual retention periods, roll up metrics before raw-data expiration, batch cleanup, and consider time partitions once justified by volume. Include completed drafts and orphaned media in lifecycle rules. Handle backup/provider retention separately.

### R7 — Medium: public pages poll the database

Evidence: `src/features/public-review/PublicReviewPage.tsx:25`.

Each visible public page polls published_review_card every 30 seconds. Long-lived visitor tabs generate ongoing database requests for usually unchanged card content. Public projection also performs entitlement and destination filtering. There is no application CDN cache in front of this direct RPC.

Mitigation: cache the public projection with a deliberate short freshness window and invalidation strategy; reduce or stop polling on hidden/idle pages. Account for how quickly deactivation and revoked entitlements must take effect.

### R8 — Medium: cross-business comparisons fetch full workspaces

Evidence: `src/features/analytics/BusinessComparison.tsx:31`; `src/hooks/usePlan.ts:18`; `src/App.tsx:114`.

Every minute, comparison analytics iterate through all readable businesses and load each full workspace, then retain only events. Requests are sequential, reducing concurrency but increasing total latency as locations increase. Plan/status polling adds recurring work; account-level and workspace-level query keys can generate separate requests, though identical keys share React Query cache.

Mitigation: use one authorized cross-business totals RPC, limit reporting dates, and refresh stable plan/status data on meaningful events with a slower fallback.

### R9 — Medium: some handlers bound bodies only after reading

Evidence: `review-events/index.ts:18`, `workspace-invite/index.ts`, `billing/index.ts`, `stripe-webhook/index.ts:24`.

Tracking/invitation limits run after request.text loads the whole body. Billing uses request.json without a found application size bound; webhook validation also reads the full body. Provider limits may constrain the impact, but the source does not enforce an early bounded read consistently. Contact intake already uses a bounded streaming pattern.

Mitigation: reuse bounded reads appropriate to each endpoint, reject excessive Content-Length as an additional early check, and apply endpoint-level request limits. Preserve untouched webhook bytes for signature verification.

### R10 — Medium: browser-session hardening is incomplete in source

Evidence: `vercel.json`; `src/lib/supabase.ts`; auth forms.

The committed Vercel configuration defines no CSP, frame-ancestor policy, or explicit referrer policy. Supabase browser sessions use SDK persistence, increasing the impact of a future XSS bug. No application MFA or CAPTCHA integration was found. Hosted password strength, leaked-password protection, Auth rate limits, and edge headers are unverified; client password checks/cooldowns are bypassable through direct Auth calls.

Mitigation: validate production headers, add a tested CSP/frame policy, configure server-side password/abuse protections, and offer MFA for privileged users. Avoid claiming a confirmed XSS vulnerability solely from local session storage or absent committed headers.

### R11 — Medium: public media and logo URLs permit broader exposure

Evidence: public buckets in migration 001; check_logo_url in migration 001:114; `CardPreview.tsx`.

Account avatars and business assets are publicly retrievable; private workspace membership does not protect these files. The logo URL validator permits any HTTPS hostname matching a Storage-style path, rather than requiring the configured project. A customer-controlled host can receive public visitors' image requests and collect network metadata. No server-side image fetch was found, so this is not a confirmed SSRF issue.

Mitigation: enforce trusted asset origin and object ownership where applicable. Keep intended brand logos public; use private/signed delivery for avatars if product requirements expect privacy. Supabase public buckets bypass read access controls for file retrieval.

Reference: https://supabase.com/docs/guides/storage/buckets/fundamentals

### R12 — Medium: billing and contact availability depend on external controls

Evidence: billing handlers/runtime; contact handler/migration; invitation migrations.

Billing endpoints authenticate but have no found application per-user frequency limit; repeated portal/checkout requests can generate Auth/database/Stripe work, even with checkout leases. Entitlements rely on webhook reconciliation; no scheduled reconciliation job was found. Failures may deny legitimate access after stored entitlement expiration. Contact Origin checks can be spoofed by nonbrowser clients; the trusted handling of x-forwarded-for needs hosted verification. Email/source limits help but do not establish global bot resistance.

Mitigation: endpoint-specific limits, webhook failure alerts, periodic reconciliation, verified proxy/client-source handling, and global contact-abuse controls. Test renewals, cancellations, invoice failures, and provider outages against hosted services.

### R13 — Medium: test/deployment assurance has gaps

Evidence: `package.json`; `tests/recovery-access.test.mjs`; `tests/review-events.test.mjs`; migration documentation; no found committed .github workflow.

npm test stops at recovery-access because its harness leaves queryClient undefined. Separately, review-events fails an assertion at line 158 (5 versus 2); the cause was not fixed or classified by this review. Thus the default command never reaches later tests. Database tests use embedded Postgres/Supabase shims and selected migration sets; their success does not verify the hosted deployment or full end-to-end Auth/Storage/Realtime behavior. Dependency audit failed because the configured registry could not resolve.

Mitigation: repair test harness/failures, gate deployment on tests plus migration replay, add hosted staging smoke tests, run dependency/secret scanning, and practice restore drills. Confirm every required migration is applied, including the new platform catalog and Shopify entries.

### R14 — Lower priority: public bundle size and duplicate enforcement

Evidence: `src/App.tsx`; current build output; `PlatformsPage.tsx`; database review-link schema.

The latest built main bundle is approximately 829 kB minified (about 248 kB gzip), shared with public pages. Several dashboard components are eagerly imported. This adds initial mobile download/parse work; the Vite chunk warning is not itself a security issue. Platform duplicate prevention is currently in the UI; the database has no unique business/platform constraint, so direct authorized API calls or concurrent clients can still add duplicates.

Mitigation: split public/customer routes from dashboard bundles. If one destination per provider is a firm product requirement, enforce it in the database after defining custom-link behavior and resolving existing duplicates.

## Cost model

Use traffic and tenant usage rather than registered account count alone.

For an illustrative month with 1,000,000 public page views and 300,000 outbound clicks:

- About 1.3 million tracking function calls without retries.
- Each identified event currently makes a publication RPC, a business lookup, and an ingestion RPC: about 3.9 million database API requests, plus approximately 1 million initial public-page reads. Internal SQL operations, polling, dashboard refreshes, retries, and bots add more.
- Tracking can retry once, raising its invocation total toward 2.6 million under widespread failures. This is not a predicted normal retry rate.
- An uncached 1 MB logo delivered once per view represents roughly 1 TB of transfer. A 100 kB logo represents roughly 100 GB. Browser/CDN caching and repeat visitors change actual transfer considerably.
- Ten thousand retained 10 MB uploads represent roughly 100 GB of storage. Use decimal units for these illustrations; uploaded file limits themselves use MiB.

Current Supabase public Pro pricing starts at $25/month, includes 2 million Edge Function invocations and then lists $2/million; 250 GB uncached egress with $0.09/GB overage; 250 GB cached egress with $0.03/GB overage; and 100 GB file storage with $0.0213/GB overage. Realtime includes 5 million messages with $2.50/million overage. These are provider prices, not Revbaze customer prices. Compute upgrades, additional projects, MAUs, Vercel usage, email, Stripe fees, monitoring, taxes, and optional backups are separate considerations. This is not a monthly bill forecast.

Pricing: https://supabase.com/pricing (checked October 11, 2026).

Do not count anonymous visitor IDs as authenticated MAUs without checking actual Auth usage; the tracking code does not create Auth users for visitors.

Configure and verify spend controls on both providers. Supabase Spend Cap excludes categories such as compute and certain add-ons. Vercel budgets do not stop spend unless the pause action is enabled; pausing is not instantaneous and makes production unavailable. Vercel firewall rules on the frontend do not automatically protect directly reachable Supabase URLs.

References:
- https://supabase.com/docs/guides/platform/cost-control
- https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations
- https://vercel.com/docs/spend-management

## Verification performed

- Default npm test: query-cache, overview, auth, session-logout pass; command stops at recovery-access.
- Individually run: public-slug, domain, database, plans, members, members-functions, billing, billing-functions, workspace-mutations, contact pass.
- Individually run review-events fails (assertion 5 !== 2 at line 158).
- Dependency audit: unavailable (registry DNS/network failure); no clean dependency-security claim is made.
- Current build artifact size inspected; earlier build/lint passed in this working session. No load tests or live security probes performed.

## Recommended implementation sequence

1. Protect public tracking ingress and replace the shared-card-only limiter with layered limits; bound endpoint body reads.
2. Enforce server-side storage quotas and upload lifecycle cleanup; resize public images.
3. Move dashboards to bounded server-side summaries and stop full-history reloads from Realtime.
4. Add measured raw-data retention, cost-by-tenant reporting, and appropriate fair-use policy.
5. Repair failing tests, establish migration/deployment gates, and verify hosted RLS/Auth/Storage/Realtime/billing behavior.
6. Validate headers/Auth protections, backups/restore, webhook recovery, and provider budgets in production.

Before estimating a safe capacity or total monthly budget, gather daily views/clicks, bot/retry ratio, events per tenant, active dashboard tabs, dashboard query latency/bytes, image size/cache-hit ratios, database/index growth, actual provider tiers/regions, and paid/free customer mix.
