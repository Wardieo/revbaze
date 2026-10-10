# Product pivot migration plan

The audit found a frontend-only prototype: Supabase Auth client scaffolding, browser-persisted review demo data, and no checked-in database schema or integration server. The pivot retains authentication and the UI foundation while removing scraping/connection adapters, review aggregation, sentiment/AI responses, competitor intelligence, and all legacy routes.

The new schema is additive. It does not drop legacy tables, erase browser data, or attempt to convert reviews into review-link cards. Old `revbaze-demo` storage is left untouched and unused; new local workspace data uses `revbaze-link-workspace-v1`. Preferences use `revbaze-preferences-v2`.

Before applying to an existing project:

1. Back up the database and inspect whether any proposed table/function/policy names already exist. If they do, reconcile the migration against the real schema; do not drop them automatically.
2. Apply the migration in a staging Supabase project. The catalog, foreign keys, unique slugs, indexes, business membership helpers, read policies, authorized mutation RPCs, and asset buckets are created together.
3. Verify two independent accounts cannot read/change one another's business, links, cards, events, or activity. Verify a viewer can read but cannot edit. Confirm anonymous/private-table access and browser-direct writes remain denied.
4. Exercise hosted Auth signup/login/recovery, image uploads, destination creation, card saving/reordering/deletion, and reload persistence. Confirm the migration's role grants match your project's defaults.
5. Configure the frontend publishable credentials and deploy the dashboard. Leave public customer routes and event ingress disabled until their separate implementation phase.

Do not delete legacy data as part of this deployment. Any future legacy-data retirement or local-to-cloud import should be a separately reviewed migration with a backup. Rollback for a production schema must be planned against real data; no destructive automatic down migration is included.

## Onboarding publication extension

Apply `202610080002_onboarding_publication.sql` after the base migration. It adds publication/completion timestamps to the existing business/card tables and one private draft table. No profile table or auth signup trigger is added; the app reuses Auth metadata for account name/avatar. The new RPCs support draft resume, optimistic concurrency, atomic publication and an explicit public projection. Anonymous business/table reads stay revoked. Test both SQL migrations together before deploying.

## Plan access extension

Apply `202610090004_plan_access.sql` after 001–003. It adds protected account entitlements, enforces account-wide quotas through triggers, and restricts analytics event history in both RLS and the workspace RPC. All accounts default to Free until an administrator provisions Growth/Pro. Review existing users' usage and assign their intended plans before deploying the frontend; records above a downgraded quota are retained but new creation is blocked. No automatic grandfathering, billing provider, payments, or data deletion is introduced. Test concurrent creation and entitlement changes in staging as part of deployment.

## Stripe billing (005)

Apply `202610090005_stripe_billing.sql` after 004. It adds protected customer mapping, checkout leases, and atomic webhook entitlement updates. Deploy/configure both Edge Functions and follow [billing setup](BILLING.md). Existing entitlements remain unchanged until a verified mapped Stripe event is reconciled. Billing tables and RPCs are server-only. Never grant browser roles write access.
