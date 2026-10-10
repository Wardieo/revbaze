# Revbaze — One link. Every review platform.

A business dashboard for creating, customizing, and managing review-link cards. Built by refactoring the existing React/Vite app; its visual system, reusable Radix-based button, authentication integration, and light/dark foundations are retained.

The app includes a business dashboard, server-saved five-step onboarding, and public pages for explicitly published review cards. Review scraping, external platform authentication, API aggregation, AI responses, review imports, campaigns, and payment processing are not implemented. Overview remains a labeled mock activity preview. Outbound clicks do not imply completed reviews.

## Run

```sh
npm install
npm run dev
npm run build
npm run lint
npm test
```

Without Supabase variables, the app opens an empty, clearly labeled **Local workspace** and stores your actual business, links, cards, and activity in browser storage. Overview uses a labeled mock activity preview; other workspace pages start with your actual empty business data. Local logos are resized to at most 512 pixels and stored as compact WebP images to keep browser storage usable. Cloud mode uploads the original accepted image. Local mode is useful for development; it is not cloud persistence, authentication, global slug reservation, or a substitute for server authorization. A local business is separate from a cloud workspace; switching modes does not automatically transfer its data.

## Supabase setup

1. Create or select a Supabase project and back up any existing database before migration. Review [the migration plan](supabase/MIGRATION.md).
2. Apply `supabase/migrations/202610080001_review_link_management.sql`, then `supabase/migrations/202610080002_onboarding_publication.sql`, then `supabase/migrations/202610080003_onboarding_templates_assets.sql`, through the project's SQL editor or your normal migration deployment workflow. The migration is additive; if these table names already exist, reconcile that schema before running it.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Only a public/publishable client key belongs in Vite. Never add a service-role key or database password to the frontend.
4. Enable email authentication and **Confirm email** in Supabase Auth. Set the Site URL to your application origin. Add the exact redirect URLs `<app-origin>/?auth_callback=signup` and `<app-origin>/?auth_callback=recovery` to Auth → URL Configuration (include the base path if hosted under a subdirectory). Add both local and production URLs. Keep the confirmation template using `{{ .ConfirmationURL }}`. Restart Vite.
5. Sign up or sign in. New users must complete onboarding before dashboard access. Returning completed users go to `/#/overview`, which remains a labeled mock activity preview. Owners can create more than one business in the schema; the initial dashboard selects the first accessible business.

Cloud mode uses authenticated Supabase reads and authorized PostgreSQL RPCs for business/link/card mutations. Card saves atomically replace ordered destinations. The database validates HTTPS URLs and provider domains independently of the browser, enforces global card slug uniqueness, checks membership roles, and rejects cross-business destinations. Direct browser writes and anonymous business reads are revoked.

Business and card logos use the public `business-assets` bucket, with uploads limited to authorized business folders. Account avatars use `profile-assets`, with uploads restricted to the signed-in user's folder. These buckets expose intentional brand/avatar images only; business records remain private. PNG/JPG/JPEG images must be under 10 MB, and SVG uploads are not accepted. Account metadata stores asset URLs rather than embedded image payloads. Unreferenced uploads can be cleaned up with a separate storage-retention job before production.

**Hosted integration still needs verification against your project.** The schema/RPCs were tested with embedded PostgreSQL and minimal Supabase auth/storage schema shims, but hosted Auth, Storage, and PostgREST still need an integration check against your project after applying the migration. No remote database was modified.

## Features

- Collapsible/mobile sidebar, grouped navigation, business identity, account menus, search, and a prominent card creation action.
- Three-step onboarding with logo upload, business/category details, manually configured review links, and first-card branding.
- Review-card create/edit/duplicate/delete, active/inactive states, search/status filters, pagination, future-URL copying, and analytics links. Duplicates start inactive. Destructive deletions require confirmation.
- Desktop editor with live preview; mobile edit/preview switch. Per-card logos, accent/background colors, button styles, heading, description, and corner options. Destination selection, enable/disable, drag-and-drop ordering, and accessible reorder arrows.
- Review destinations: Google, Facebook, Trustpilot, Yelp, G2, Capterra, Tripadvisor, Product Hunt, App Store, Google Play, and custom HTTPS URLs. Edit names/URLs, toggle, remove, test links, and see which cards use them. Connection type is always **External Link**. Disabling/removing the last usable destination deactivates affected cards.
- QR codes generated locally using `qrcode`, with PNG/SVG downloads, foreground/background colors, high error correction, optional embedded logos, contrast validation, and regeneration. Scan-test before printing, especially with logos. Keep card slugs unchanged after printing.
- Overview/analytics use saved card data and actual stored events. Seven-, thirty-, ninety-day and custom ranges, card/platform filters, platform distribution, traffic-source domains, and CSV export. Date ranges and day grouping use Asia/Manila consistently.
- Business profile, account changes, notifications/preferences, light/dark/system themes, and an explicitly nonpayment billing placeholder. Theme and sidebar preferences are per-browser; account metadata and notification preferences persist through Supabase when configured. Notification delivery is not part of this phase.

## Analytics and tracking boundary

`CTR = outbound link clicks / page views × 100`, with zero views producing 0%. Platform filters restrict outbound clicks while preserving page views as the denominator. An outbound click is **never** a completed review, and multiple clicks in one visit can produce a CTR above 100%. Unique visitors count distinct anonymous browser hashes across the selected date range; older events without identifiers are excluded.

Published review pages record views and outbound clicks through the public `review-events` endpoint. Dashboard previews and QR generation do not create events. The private `review_card_events` table stores events with per-business hashed anonymous browser identifiers; `workspace_visitor_events` returns authorized daily aggregates with pagination. No IP addresses are stored; referrers are domain-only.

The service-role-only `ingest_review_event` RPC prepares the next phase: it checks active cards/destinations, deduplicates event IDs, sets timestamps server-side, and caps each card at 120 events/minute. It is inaccessible to anonymous and authenticated browser roles. Before public launch, put it behind a server/Edge Function that validates signed card sessions, enforces abuse controls/retention, minimizes tracking, and keeps service credentials private. Do not grant anonymous database access as a shortcut.

## Structure

```text
src/
  components/{ui,layout,shared}/
  features/{auth,onboarding,overview,review-cards,review-platforms,analytics,qr-codes,business,settings}/
  hooks/       # session and feedback hooks
  lib/         # Supabase client, platform catalog, validation, analytics, colors
  services/    # local/cloud persistence and image uploads
  stores/      # workspace state and browser preferences
  types/       # business/card/link/event models
supabase/migrations/
tests/
```

## Verification

`npm test` runs destination/slug/CTR/QR-contrast tests against the actual TypeScript modules and PostgreSQL migration/security tests using PGlite. Database checks cover role access, anonymous denial, cross-business reads/writes, viewer restrictions, atomic saves, URL validation, slug uniqueness, event deduplication, and automatic deactivation of empty cards. These tests touch no live database.

The onboarding, destination validation, card CRUD/reordering/reload persistence, PNG/SVG downloads, theme controls, mobile navigation, and preview layout were also exercised in a local headless Chrome browser. Hosted Supabase behavior is the remaining deployment verification described above.

## Login, signup, and email delivery

Dedicated pages live at `/#/login`, `/#/signup`, `/#/check-email`, and `/#/forgot-password`. They do not render workspace navigation. Signup collects a name and matching passwords and requests an email confirmation with an explicit redirect. With confirmation enabled, the customer sees a check-inbox page and can correct their email address and resend a link. Confirmation establishes the session before routing into business onboarding. Existing businesses go directly to their dashboard. If confirmation is disabled in Supabase, signup creates a session immediately and proceeds to onboarding. Recovery links open a separate new-password page after the SDK reads the email tokens. Expired links offer a fresh request.

**Email delivery requires server configuration.** Supabase's default mail service restricts recipients to authorized organization addresses and has strict rate limits. Configure a custom SMTP provider in Auth → Email/SMTP for customer signup, verify your sender domain, and check Auth logs and your provider's delivery logs if an email is missing. See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp). The frontend cannot override delivery restrictions or SMTP credentials. Never put SMTP secrets into a `VITE_` variable. A successful resend request confirms that Supabase accepted the request, not that a mailbox received it. Check spam as well.

An empty `{}` server error now produces a readable fallback rather than being shown verbatim. Check Supabase Auth logs for the underlying error; empty responses alone do not establish a delivery cause. Unconfirmed email, rate limits, SMTP errors, invalid credentials, and network failures have actionable messages. Backend rate limits apply in addition to the page's resend cooldown. Authentication tests use mocked responses and send no real emails.

### Signup returns an empty error

The installed auth-js SDK discards the JSON body for retryable HTTP 5xx responses. The app now preserves the Auth server's message while retaining the original status and SDK retry behavior. SMTP failures and database signup failures are distinguished; a 500 response without a JSON message reports its HTTP status. No request bodies or credentials are logged.

If signup fails, inspect Supabase → Logs → Auth for the matching timestamp, then Postgres logs if the error mentions saving a user. Check existing `auth.users` triggers: a trigger referring to a missing legacy `profiles` table can block signup before email delivery. Do not remove triggers without checking their purpose. For an email-sending error, inspect custom SMTP settings and provider logs. URL Configuration alone does not configure mail delivery.

Development uses port 5173 with `strictPort` so Vite cannot silently switch to a port missing from the Supabase redirect allowlist. Use `http://localhost:5173` to match the configured localhost callbacks; `127.0.0.1` is a different origin and needs its own redirect entries if used.

## Overview preview

The Overview tab uses deterministic sample activity for Studio North, independent of Supabase workspace tables. It skips the workspace query and onboarding gate on this route, so a missing `public.businesses` table cannot block the preview. Authentication and the other navbar pages retain their existing behavior; their cloud database setup still requires the migration. No remote schema is changed by this preview.

The 7/30/90-day filters recalculate statistics, chart series, platform distribution, and card rows from the same daily dataset. Comparisons use the immediately preceding equal-length period. Active cards describe current status; inactive cards may have historical traffic. Chart legends toggle series and hovering shows daily totals. Copy Link copies the labeled example URL and QR Code opens a downloadable QR preview. The example URL is not a published customer page. Mock cards exist only within Overview and are not written into workspace storage.

## Animated onboarding and publication

Authenticated first-time users are gated by `onboarding_status()` before any dashboard route. The standalone wizard collects account details, business information, review URLs, and card appearance, then publishes. Account name/avatar reuse existing Supabase Auth metadata rather than introducing a second profile table. Existing Google account metadata is prefilled if available; this change does not add a Google OAuth provider.

Drafts persist to the private `onboarding_drafts` table after a short debounce and before moving forward. Writes are serialized and revision-checked to prevent another tab from silently overwriting changes. Profile images use `profile-assets`; business logos use `business-assets`. Both accept PNG/JPG/JPEG under 10 MB. Migration 003 updates existing bucket limits and persists the four card layouts (Centered, Editorial, Spotlight, Platform grid). The published card uses the selected layout, and the share-step QR embeds the business logo in both PNG and SVG downloads. Platform URLs are validated in the browser and again on publication in PostgreSQL. Slug availability is checked while editing; the existing database unique constraint handles concurrent publication.

`publish_onboarding()` commits platform links, ordered card destinations, publication time, and business onboarding completion in one transaction. A failed transaction displays an error and leaves onboarding incomplete. Retrying a completed publication returns the existing card. Existing unfinished owned businesses/cards can be resumed; new-business setup allocates separate IDs and leaves other businesses intact. Start a separate business through Account menu → Set up a new business. Complete businesses are listed in the account menu; choosing one changes the workspace used by the other dashboard pages.

The public page lives at `/#/review/<slug>` and works without sign-in. `published_review_card()` exposes only the selected customer-facing fields of active, published cards and their enabled destinations. Other business records and onboarding drafts remain private. Deactivated or unpublished cards return an unavailable page. Public clicks are external links; this phase does not add anonymous tracking ingestion.

Copy Link, Open Review Card, and PNG/SVG QR downloads use the same actual card URL. In development this is the current app address, even if a production domain is set in `.env.local`. In production, `VITE_PUBLIC_CARD_ORIGIN` must point to a deployed instance of this application using the same Supabase project; leave it unset to use the current app origin. Publish/deploy the frontend on a publicly reachable host before distributing QR codes to customers. Hash routes preserve the existing routing setup and work without a server-side route fallback.

### Deploy the backend

The hosted project was checked read-only and its business/card/draft tables were missing. Run both migration files in the Supabase SQL Editor, in the order listed above. If you have already applied the first migration, run only the second. Review existing table names before applying to a different project. The public client key cannot apply database migrations, and no hosted database was modified during implementation. Refresh the app after migration; incomplete users will open onboarding.

Tests exercise actual PostgreSQL functions in PGlite, including ownership/RLS, draft revision conflicts, URL rejection, slug collisions, rollback on failed publication, public field projection, completion, idempotent retry, and separate businesses. The optional `tests/onboarding-server.mjs` harness runs isolated PostgreSQL on `127.0.0.1:8181` for browser verification; it never connects to hosted Supabase and is a development test tool, not a production backend.

To rerun the optional browser test with Python's `websockets` package installed: start Chrome with a separate test profile and remote debugging on port 9223, run `node tests/onboarding-server.mjs` in a fresh process, start Vite with `npm run dev -- --host 127.0.0.1 --port 5181`, then run `python3 tests/onboarding-browser.py`. The driver intercepts Auth calls and sends RPCs to the isolated database. Restart the harness before each full run to reset its test data. No emails or hosted user accounts are created.

The final onboarding step offers Classic, Rounded, and Dots QR styles, color controls, a business-logo toggle, and an optional separate QR logo upload to `business-assets` (PNG/JPG/JPEG under 10 MB). Preview, PNG, and SVG use the same design with high error correction and a four-module quiet zone. QR design preferences are saved in this browser per business and review URL; they are not synchronized between devices.

## Public marketing website

The public home at `/` and `/product`, `/features`, `/solutions`, `/pricing`, `/about`, `/contact`, and `/resources` use a dedicated BrowserRouter layout. Resource guides and `/privacy` and `/terms` have their own pages. Existing dashboard/auth/onboarding routes retain their `/#/...` URLs, including `/#/overview`, `/#/login`, and `/#/signup`. Marketing pages link to those existing flows.

Configure your production host to serve `index.html` for public page paths, so direct links and refreshes work. Marketing metadata (titles, descriptions, canonical and Open Graph URLs) updates per route in the browser. For fully indexed per-page HTML and social crawler previews, add prerendering/SSR to your deployment; the current Vite app renders public pages on the client.

Interactive marketing previews use a sample business and explicit sample activity. QR demo destinations use example.com. Analytics/integrations and proposed pricing are labeled by availability. The contact page prepares a message for copying and does not send it. Legal pages are clearly labeled placeholders pending final operator-approved policies. No testimonials, customer counts, or partnerships are claimed.

## Plan access and pricing

All public pricing and Settings use the same catalog: Free $0, Growth $10, Pro $29 per month (USD). Annual billing is not configured. Apply [migration 004](supabase/migrations/202610090004_plan_access.sql) after migrations 001–003 before deploying this frontend. The hosted database has not been changed automatically.

Free allows 1 owned business, 1 total review card, and 3 enabled destinations per card. Growth allows 2 owned businesses and 5 total cards with unlimited destinations. Pro has no plan-specific business/card/destination cap. Counts include inactive cards and saved business drafts; disabling a card does not release its slot, deleting it does. Team members inherit the workspace owner's entitlement, and their own account quotas remain separate. Existing records are retained after downgrade; creation is blocked above the new quota, and saved destinations must satisfy the current per-card limit.

`account_plans` is protected by RLS and read-only to authenticated clients. Accounts without a record, or with an expired record, use Free. Only trusted database administration or a future verified billing webhook may assign paid access. For development/admin provisioning, run this in the Supabase SQL editor with an actual auth user UUID:

```sql
insert into public.account_plans (user_id, plan, expires_at)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid, 'growth', now() + interval '1 month')
on conflict (user_id) do update
set plan = excluded.plan, expires_at = excluded.expires_at;
```

Use `pro` or `free` to assign another tier. A null expiry represents an explicit administrator-provisioned entitlement without expiration. Migration 004 has no browser-side entitlement switch. With migration 005 and the deployed billing functions, verified Stripe renewals update access. Never expose a service-role key to the frontend.

Server triggers serialize account quotas and protect business/card creation and enabled card destinations, including onboarding publication and duplicated cards. Analytics event reads and the aggregation RPC enforce 12 months for Growth, 24 months for Pro, and no history for Free. Free generates basic QR downloads; custom style/color/logo controls are locked and cached paid designs render as basic after downgrade. QR generation happens in the browser, so this restricts the app's customization controls rather than preventing someone from using another QR generator.

Analytics and integrations retain their clearly labeled mock previews, now restricted to paid workspace entitlements. Customer CSV import, live integrations/webhooks, and priority-support delivery remain planned. Paid checkout is implemented separately in the Stripe billing section below. Overview still shows its labeled sample activity. Settings displays real account plan/usage from the database and links to the upgrade screen and Stripe billing portal.

`npm test` includes isolated PostgreSQL plan tests for quotas, rollback, protected assignment, shared workspace access, expiration, downgrade, and history retention. The local onboarding browser harness provisions a Growth test account and also verifies Free locks and basic QR downloads. It never creates hosted accounts or charges users.

### Stripe billing

Modern plan selection is available at `/#/upgrade`; Settings → Plans & billing shows usage and links to Stripe’s customer portal. Checkout and signed-webhook handlers are implemented as Supabase Edge Functions. Apply `202610090005_stripe_billing.sql` after migration 004 and follow [Stripe billing setup](supabase/BILLING.md) to configure the rotated server secret, monthly Stripe prices, webhook, and portal. The supplied Growth/Pro Product IDs are supported by server-side monthly price resolution. No payment credentials are bundled in the frontend, and a checkout redirect never grants plan access.

### Live review activity

Published review pages record page views and outbound destination clicks through the `review-events` Edge Function. Dashboard previews do not generate events. The endpoint resolves the published card on the server, validates enabled destinations, stores only the referring hostname, and uses the existing idempotent ingress and 120-events-per-card-per-minute cap. Outbound clicks measure navigation, not completed reviews.

Apply `supabase/migrations/202610090006_review_events_realtime.sql` and deploy `review-events` with `supabase functions deploy review-events --use-api`. Overview and Analytics subscribe to event inserts for the selected workspace and refetch aggregated metrics. They also refresh every 30 seconds as a fallback. Existing workspace ownership and Growth/Pro analytics policies continue to apply; Free can collect events but cannot read analytics. Historical clicks that were never tracked cannot be reconstructed.

### Visitor and source analytics

Apply migration 008 and redeploy `review-events` for anonymous browser counts. The public page keeps a random ID in localStorage (memory fallback when storage is blocked); ingress HMAC-hashes it with the business ID before saving. Analytics counts distinct hashes on page views across the selected date/card range. Different devices or cleared browser storage count separately; this does not identify people. Historical events without hashes are excluded from unique counts. Sources use `utm_source`, then referring hostname, otherwise Direct / unknown. Generated review QR codes tag new scans as `qr`; previously printed codes keep working but cannot be classified without a referrer.
# revbaze
