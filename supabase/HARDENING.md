# Tracking, analytics and image hardening

## Deploy together

These source changes are not deployed by editing the repository. Coordinate the frontend, migrations and functions; old frontends do not send tracking tokens and cannot use the new upload path. Open tabs should refresh after deployment.

1. Apply migrations **029**, **030**, **031**, after all earlier migrations. Migration 030 builds daily counters from existing events; run during a quieter period and measure its duration on large databases. Database migration transactions must be allowed to finish before deploying the matching frontend.
2. Set Edge secrets `TRACKING_SIGNING_SECRET` and `ASSET_CLEANUP_SECRET` to separate random values of at least 32 characters. Keep them out of `VITE_` variables. `APP_URL` must equal the actual frontend origin (scheme and hostname, without a trailing slash). Existing Supabase and PayMongo secrets remain required.
3. Deploy `review-events`, `image-upload`, `asset-cleanup`, and the updated `billing`, `paymongo-webhook`, `billing-renewals`, `workspace-invite` functions with the committed `supabase/config.toml` settings. Functions explicitly verify their own authorization.
4. Store the project origin in Supabase Vault as `revbaze_project_url` and the cleanup secret as `revbaze_asset_cleanup_secret`. Run `supabase/scripts/schedule-asset-cleanup.sql` once; re-running the named schedule updates it. Check cron/HTTP results for failed cleanup runs and alert on failures.
5. Deploy the frontend and verify hosted smoke tests below. Keep Supabase/Vercel usage alerts enabled. A Vercel-only firewall does not protect the directly reachable Supabase function endpoint.

Scheduling uses Supabase's documented Cron + pg_net + Vault pattern: https://supabase.com/docs/guides/functions/schedule-functions

## Tracking controls

`review-events` supports a session request, then signed event submissions. Tokens expire after 15 minutes and bind the slug, card, visitor UUID and HMAC of the caller address. The handler uses the **rightmost** `x-forwarded-for` value. Verify that the actual hosted gateway overwrites/appends a trusted client address. If you use another proxy, verify its behavior before enabling tracking. Missing caller addresses fail closed with 503; page rendering/navigation continue even if tracking fails.

Shared database rate counters apply before publication/business lookup. Default per-minute ceilings are 10,000 requests globally, 3,000 per slug, 120 per caller, 40 per caller/slug and 20 per tracking session/bootstrap bucket. Requests to mint tokens also consume limits. The raw ingestion function retains a 3,000-event/minute final card backstop. Rejected requests do not roll back limiter counters. Cleanup expires old counters in bounded batches.

These defaults should be tuned to measured traffic, including users sharing Wi-Fi/NAT. A signed token is not proof of a human; distributed bots can obtain valid sessions. Gateway/WAF controls and monitoring remain necessary for large attacks and invocation costs. Tokens are validated against current publication state for each event; unpublished/disabled destinations cannot continue using an old token. Clients do not retry 4xx/429 responses and retry transient failures at most once with the same event UUID.

Bodies are bounded while streaming: tracking 4 KiB, billing 8 KiB, invitation 4 KiB, webhook 256 KiB. Webhook signature verification still receives the untouched UTF-8 JSON body.

## Analytics

Workspace metadata loads do not fetch events. Overview uses a private visitor-free daily rollup and downloads up to 180 days of daily totals. Card-list metrics use compact totals across the plan's allowed history. Realtime listens only for business/card/destination metadata, throttles those changes for one second, and removes subscriptions in hidden tabs. Summary queries refresh every 30 seconds while visible; business comparisons refresh every minute. Public pages refresh card content every five minutes and on focus.

Analytics sends reporting dates, timezone, card, platform and source to an authorized RPC. The database limits queries to the plan history window and a maximum requested range of 731 days, and returns aggregates without visitor identifiers. Exact distinct browser counts are computed for each period, card and source; daily uniques are never summed. Cross-business comparison uses one authorized summary request and only owned businesses.

General-timezone/source reporting still scans **bounded raw events** for accurate day boundaries and distinct visitor counts. This is not a claim of constant-time reporting at any traffic volume. Overview/card counts use daily rollups. Reports over 20,000 aggregate rows return an explicit error asking for a narrower range instead of silently truncating results. Raw events are retained; this change does not delete historical visitor data or change the advertised history windows.

## Images

New images are decoded and re-encoded in the browser to a maximum of 512 pixels on the longest edge; PNG transparency is preserved. The server independently checks byte size, format structure and dimensions (maximum 512 KiB and 1024 pixels); it does not trust browser MIME/size claims alone. This is structural image validation, not an antivirus scan or a server-side image-decoding service.

Authenticated uploads reserve quota bytes in a service-only ledger under an account transaction lock **before** Storage upload. Pending uploads count against the quota. Per account: Free 20 MiB, Growth 100 MiB, Pro 500 MiB across business images and avatars. Each actor may reserve ten uploads per ten minutes. Direct browser Storage INSERT is denied. Ownership/member permissions are checked from the verified Auth user; clients cannot choose another actor. Existing files belonging to known users/businesses are included in the migration's quota ledger, with unknown sizes counted conservatively.

Do not remove the ledger row for a failed upload to evade accounting. Failed/unreferenced reservations become eligible for cleanup after 24 hours. New image URLs are returned only after successful Storage upload and ledger completion.

Cleanup protects references in business logos, card appearance settings, unfinished onboarding drafts and Auth profile metadata. Shared images remain while any supported reference exists. Completed draft copies do not keep obsolete files forever. Reference writes and retirement lock the same asset record; retired files cannot acquire a new reference during deletion. Storage API deletion happens before the ledger is marked deleted/releasing quota. Failed deletions remain retryable. The batch size is 100, the schedule is every five minutes, and files must be at least 24 hours old.

Files are deleted through the Storage API, not by deleting storage.objects rows. Arbitrary unmanaged files whose owner/business no longer exists are not assigned to another account; handle these legacy orphans in a separately reviewed inventory. Direct owner deletion remains available but may leave a conservative ledger reservation until cleanup.

## Verification

`npm test` now includes full migration replay and hardening tests, as well as repaired recovery/Realtime test harnesses. Tests cover token tampering/expiration, visitor/caller binding, early limits, bounded bodies, tenant isolation, exact unique visitors, image validation, denied direct uploads, byte allowances and safe shared-image retirement. Deployable Deno handlers are type-checked by the billing-functions test; embedded database tests use Supabase schema shims.

Hosted smoke checks are still required: valid public tracking, 429 behavior, proxy caller headers, thumbnail upload, denied direct Storage upload, quota refusal, Realtime hidden-tab behavior, source/timezone/card reports, uploaded image referenced by multiple cards, expired unused image cleanup, and billing/invitation requests. Monitor summary latency, cleanup failure counts, rejected tracking rates and storage/egress usage. These tests do not certify unlimited scale or distributed-bot immunity.
