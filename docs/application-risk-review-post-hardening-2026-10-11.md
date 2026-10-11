# Revbaze review after hardening

Reviewed October 11, 2026. This supersedes the pre-hardening findings in application-risk-review-2026-10-11.md for the current source. Scope includes authentication/recovery, onboarding, businesses/members, review platforms/cards, public pages, tracking, analytics/export, media, integrations, contact, billing, migrations, tests and deployment configuration.

This is a source and local-test review. It does not verify the deployed database, hosted proxy behavior, production secrets, Auth settings, backups, budgets, cron execution or provider logs. No production penetration or load test was performed. Application code was not changed during this reassessment.

## Improvements verified in source

- Tracking requires signed, short-lived sessions bound to caller, visitor, slug and card. Body reads are bounded and requests have layered rate limits.
- Overview uses daily rollups. Analytics filters and exact unique counts execute server-side with date bounds. Comparison uses one summary request instead of loading each workspace's history.
- Realtime subscribes to metadata rather than event inserts, stops when hidden, and throttles invalidation. Analytics refresh independently every 30 seconds in visible tabs.
- New uploads pass authenticated server authorization, image validation, atomic quota reservations and frequency limits. Browser Storage INSERT policies are removed. Maximum new image size is 512 KiB; account allowances are 20/100/500 MiB for Free/Growth/Pro.
- Unreferenced managed images have a delayed cleanup mechanism with retirement guards. Public page polling is now five minutes rather than 30 seconds.
- Earlier test harness failures were repaired. Full migration replay and tracking/upload regression checks were added.

Authorization foundations remain useful: RLS, role-checked mutation RPCs, private entitlement tables, published-card projections, server plan enforcement, signed Stripe webhooks and billing leases. No confirmed cross-tenant database read bypass or payment-entitlement forgery was identified in this review. This is not proof that none exists.

## Remaining findings

### P1 — High: rejected tracking requests consume shared allowances

Evidence: `supabase/migrations/202610110029_tracking_protection.sql:8`; `supabase/functions/review-events/index.ts:67`.

The limiter increments every counter even after a caller or session exceeds its own cap. Anonymous session-bootstrap requests reach it without a signed token, before published-card validation. A caller sending more than 3,000 validly shaped requests per minute for a slug can consume that card's allowance; more than 10,000 requests per minute can consume the application-wide allowance. Invalid/unpublished slugs also consume the global counter. Requests denied by caller limits still contribute. This attack does not require distributed IP addresses if the attacker can sustain the request rate.

Effect: legitimate events receive 429 responses and analytics are lost. Public review pages can still render; this is analytics denial, not necessarily whole-site downtime. Function invocation and limiter database work continue for rejected requests. All requests also update the same global row, creating contention under load.

Fix: retain counting of rejected attempts in caller-specific abuse buckets, but stop before charging shared admission allowances when that caller has already been denied. Add enforcement at the actual Supabase ingress and separate operational spend protection from shared analytics capacity. Test that a repeatedly denied caller cannot exhaust another caller's card/global budget; benchmark concurrent limiter calls.

### P2 — High: expensive legacy analytics APIs remain callable

Evidence: grants in migrations `202610090008_visitor_analytics.sql`, `202610090009_edit_review_platform.sql`, `202610090012_analytics_timezones.sql`; raw event SELECT grant in `202610080001_review_link_management.sql:111`.

The UI uses bounded summaries, but authenticated users retain access to older history/visitor/timezone RPCs and authorized raw event queries. Their own tenant's history can still be grouped or downloaded through direct API calls. This is a resource-abuse exposure, not an observed cross-tenant bypass.

The new `analytics_summary` also materializes raw events and computes distinct visitors over the current and comparison periods. Its 20,000-row response cap is checked after grouping and JSON construction. A bounded date range does not bound the number of events or the work required. High-card/source cardinality can still be expensive.

Fix: retire or revoke unused legacy endpoints after coordinating client deployment; define a bounded detail endpoint if needed. Add database statement timeouts and reporting concurrency/frequency limits, constrain result cardinality before JSON assembly, and measure representative query plans. Preserve exact unique semantics when selecting a more scalable aggregation strategy.

### P3 — Medium: managed media reference ownership is not enforced

Evidence: `supabase/migrations/202610110031_managed_image_uploads.sql:61`; `check_logo_url` in migration `202610080001_review_link_management.sql:114`.

The new reference guard locks a matched managed asset and checks that it is ready, but does not check that the referencing business/account owns it. An account that learns another account's public image URL can reference it in its own editable logo/card/draft. Cleanup considers that reference and can keep the original owner's image charged to its quota after the owner replaces it. Public logo visibility is intentional; indefinite quota pinning by unrelated accounts is a separate issue.

The logo validator also accepts an arbitrary HTTPS hostname with a Storage-style path. Unknown paths do not match a managed asset and therefore receive no ledger ownership/status validation. This can send visitors' image requests to an external customer-controlled host. No server-side fetch was found, so this is not a confirmed SSRF issue.

Fix: validate the configured Storage origin and permitted asset ownership for each reference type, including legitimate team access and same-owner reuse. Add cross-owner reference rejection tests. Decide whether profile avatars should remain publicly retrievable.

### P4 — Medium: cleanup loses inventory on account deletion

Evidence: `supabase/migrations/202610110031_managed_image_uploads.sql:6,19,77`; `supabase/functions/asset-cleanup/index.ts`.

Deleting an Auth user cascades deletion of its managed_assets rows. The cleanup worker enumerates only those rows, so it cannot subsequently find the user's remaining Storage files. Existing files whose folder cannot be joined to a current owner are also excluded from the initial backfill. These are conditional orphan scenarios; no live orphan count was measured.

Browser Storage DELETE remains permitted for owned files. It does not update the ledger immediately. An unreferenced deleted file remains charged until cleanup; a still-referenced but physically deleted file can retain a ready ledger row and broken image reference.

Cleanup checks references through substring searches across businesses, cards, drafts and Auth metadata for each candidate. A batch of 100 does not bound all rows examined to find those candidates. Deleted ledger tombstones also accumulate.

Fix: retain a cleanup inventory through account deletion, reconcile Storage objects against the ledger, route deletions through lifecycle bookkeeping, and replace repeated document searches with indexed reference records as volume requires. Define tombstone retention. Monitor cleanup backlog, failures and quota drift.

### P5 — High business-cost risk: usage and retention are still unbounded

Evidence: `src/lib/plans.ts:31`; event/activity schema and ingestion; no found raw-data retention schedule.

Pro still advertises unlimited businesses and cards at $29/month. Storage now has a cap, but tenant event volume, reporting work and paid platform-link counts do not have comparable allowances. A shared per-minute tracking ceiling is not a per-tenant monthly budget. It can also let one busy tenant affect others.

Raw events, click activity, contact records, completed drafts and deleted asset ledger rows have no found age-based purge job. Analytics visibility windows restrict reads rather than delete data. Database size, indexes, maintenance and backups can grow indefinitely.

Fix: measure cost by tenant; define enforceable traffic/reporting allowances and high-volume pricing without silently changing promised entitlements. Set explicit retention periods, preserve intended summary history, and delete expired records in bounded batches. Verify rollup-delete behavior before introducing retention: current event DELETE triggers subtract from daily totals, so simply deleting raw events would also remove those totals.

### P6 — Medium: signed sessions do not prove human traffic

Evidence: `supabase/functions/review-events/index.ts:47,94`; `_shared/tracking.ts`.

Bots can request their own legitimate tokens and generate new visitor identities. Signing prevents token tampering, not bot-generated metrics. Caller limits can also reject legitimate visitors sharing an office, hotel or mobile-network address. The handler assumes the rightmost x-forwarded-for value is a trusted caller address; absent headers produce 503. Hosted behavior is unverified.

Fix: verify proxy header semantics on the hosted ingress, monitor rejection rates and anomalous traffic, and add bot challenges or ingress rules where justified. Distinguish suspicious events from trusted conversions. Test shared-network traffic and IP changes during a session.

### P7 — Medium: authentication and browser headers need production verification

Evidence: `vercel.json`; `src/lib/supabase.ts`; authentication forms.

Committed hosting configuration has no CSP, frame-ancestor policy or explicit referrer policy. No application MFA/CAPTCHA integration was found. Browser SDK sessions persist locally, increasing the impact of a future XSS vulnerability; no confirmed XSS sink was identified. Client password rules and cooldowns do not establish server-side Auth protection.

Fix: verify deployed headers and hosted Auth rate/password protections, implement a tested CSP and framing policy, and consider MFA for owners/admins. Confirm recovery, invitation, redirect and logout behavior against hosted Auth.

### P8 — Medium: billing, contact and operational recovery still depend on external controls

Evidence: billing, stripe-webhook, workspace-invite and contact-message handlers; `supabase/HARDENING.md`.

Billing has authentication, leases and reconciliation, but no found per-user frequency budget for repeated requests or scheduled entitlement reconciliation. Webhook/provider failures need alerts and a recovery path. Contact intake has bounded bodies and source/email limits; Origin checks alone do not block nonbrowser bots. Integration configuration is stored, but no active server delivery worker was found; validate webhook destinations against SSRF before adding one.

The hardening migrations, Edge deployments, secrets and cleanup cron must all be installed together. Applying SQL alone does not activate every protection. Cleanup failure can fill quotas. Migration backfills scan existing history/files and need a production-sized rehearsal. No committed CI workflow was found. Production backups, restore drills, ingress protection and spend controls are unverified.

Fix: establish deployment gates and hosted smoke tests, monitor tracking/cleanup/webhooks, periodically reconcile billing, apply endpoint-specific limits, verify provider budgets and practice restoration. Protect directly reachable Supabase endpoints as well as the frontend domain.

### P9 — Lower priority: public delivery and product invariants

Evidence: `src/App.tsx`; `PublicReviewPage.tsx`; review-link schema; current build.

The main bundle is 831.11 kB minified / 248.49 kB gzip and includes eagerly imported dashboard components. Public projection polling is reduced but remains a direct database request without an application cache. Platform duplicate prevention remains UI-only; concurrent or direct authorized writes can create duplicates.

Fix: split dashboard routes from public delivery, evaluate cached projections with deliberate deactivation freshness, and enforce provider uniqueness in the database if that is a firm product rule. These are performance/product issues rather than demonstrated authorization bypasses.

## Cost planning

No reliable monthly bill or supported tenant count can be derived from source alone. Track legitimate versus rejected function calls, token bootstraps, events per tenant, analytics query duration/bytes, active dashboard tabs, image cache-hit ratios, cleanup backlog and database/index growth.

For illustration, one million views plus 300,000 clicks produces 1.3 million event calls before retries, plus token bootstrap calls. If every view starts an uncached session, bootstraps add approximately one million calls. Public projection reads and polling are additional. A 100 kB image delivered one million times without effective caching is approximately 100 GB of transfer. Server-side summaries reduce downloads but still incur database computation.

No current provider price quote is used in this reassessment. Use actual hosted usage and verified provider prices when preparing a budget.

## Priority order

1. Correct rejected-request accounting so one caller cannot consume shared tracking allowances.
2. Close unused analytics APIs and benchmark bounded reports with realistic high-volume data.
3. Enforce image-reference ownership and preserve cleanup inventory through account deletion.
4. Implement retention and tenant usage budgets, including correct rollup preservation.
5. Verify coordinated deployment, hosted ingress/Auth/Storage/cron/billing, monitoring, backups and spend controls.

The full `npm test` suite (18 scripts), production build, lint and `git diff --check` passed during this review. Coverage includes full migration replay, tenant authorization, tracking sessions/limits, upload quotas/retirement, authentication, memberships and billing. The newly identified shared-limit accounting and cross-owner reference scenarios are not covered by rejection tests yet; passing the existing suite does not resolve them. Local tests do not establish production security or maximum capacity. Dependency vulnerability auditing remains unverified; the earlier registry/network failure is not a clean audit result.
