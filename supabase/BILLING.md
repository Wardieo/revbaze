# Stripe subscriptions

Apply migrations 001–005 in order. The app has a standalone authenticated plan chooser at `/#/upgrade`; Settings → Plans & billing shows verified access, usage, and a Stripe billing portal button. Growth is **$10 USD/month** and Pro is **$29 USD/month**, without annual billing or trial offers.

## Configure and deploy

1. **Rotate the Stripe secret key pasted into chat.** Never put a Stripe secret, signing secret, or Supabase service-role key in frontend `.env.local` or any `VITE_` variable.
2. In Stripe test mode, ensure these products each have one active **recurring monthly USD price**, quantity one:
   - Growth: `prod_VP9uiiTaVyCQXZ`, $10.
   - Pro: `prod_VPGUdWntszPKKt`, $29.
   Copy their `price_…` IDs if there are multiple prices. The server accepts either a Price ID or a Product ID, resolving and validating the amount/currency/interval before checkout. Product IDs alone do not create a price.
3. Copy `functions/.env.example` to `functions/.env` and enter your **rotated** test secret and signing secret. Set `APP_URL` to your app’s exact origin (`http://localhost:5173` locally, HTTPS in production). Never commit this file. Deployed functions automatically receive Supabase URL and service-role credentials.
4. Link the Supabase CLI to your project, then run:
   ```sh
   supabase secrets set --env-file supabase/functions/.env
   supabase functions deploy billing
   supabase functions deploy stripe-webhook
   ```
   `supabase/config.toml` disables gateway JWT validation for these functions. The billing handler explicitly validates the user token using Supabase Auth; the webhook validates Stripe’s signature against the untouched request body and rejects timestamps beyond five minutes.
5. Register a **snapshot** webhook destination at `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook` for:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.paid`, `invoice.payment_failed`
   Set its `whsec_…` signing secret in Supabase secrets. CLI forwarding uses a different signing secret from the dashboard endpoint.
6. Activate/configure the Stripe customer portal. Allow payment methods, invoice history, cancellation, and switches between the configured $10/$29 monthly prices. For a dedicated portal configuration, set its `bpc_…` ID as the server secret `STRIPE_PORTAL_CONFIGURATION_ID`. Set upgrades to invoice immediately (`always_invoice`) so customers pay before their higher tier activates; configure downgrade timing deliberately. Existing subscribers use a selected-plan confirmation flow in this portal rather than creating another subscription.
7. Test with Stripe test payment methods: successful checkout, failed payment, cancellation at period end, immediate cancellation, Growth→Pro, and replayed webhooks. Confirm the `account_plans` row and the application’s actual access change. Going live requires matching **live** Product/Price IDs, a live secret, and the live endpoint’s signing secret.

## Invoice emails

Subscription Checkout automatically creates invoices, including renewals and invoiced upgrades. Revbaze supplies the authenticated account email when creating a Stripe customer and refreshes it before subsequent checkout or upgrade requests.

In [Stripe Settings → Business → Customer emails](https://dashboard.stripe.com/settings/emails), enable **Successful payments** and save. Stripe sends the paid invoice receipt after a successful payment; cancellation or a declined payment does not trigger it. This dashboard setting must be enabled in Stripe; deploying the functions alone does not enable automatic emails. Customers can also access invoice history through Settings → Plans & billing → Manage billing.

**Test mode:** automatic receipt emails are not sent for test payments. To test delivery, open the successful payment in Stripe → Receipt history → ⋯ → Send receipt, confirm the email address, and send. See [Stripe receipts and paid invoices](https://docs.stripe.com/receipts). Configure receipt branding and business details in Stripe before launching live billing. No separate Supabase SMTP configuration is needed for Stripe's emails.

## Access and reliability

A success redirect never grants access. Signed webhooks map a Stripe customer to an account through a protected table, serialize reconciliation using a database lease, retrieve current subscription state, and atomically update `account_plans` plus the processed-event ledger. Duplicate events are harmless; delayed events use fresh Stripe state. If reconciliation fails, Stripe receives a non-success response and can retry.

Recognized active subscriptions require a paid latest invoice before access is granted through their current period end. Provider-authorized trials retain their trial access. Past-due, unpaid, incomplete, paused, cancelled, or unknown-price subscriptions grant Free access. Cancellation at period end retains paid access until the period ends. Existing above-limit content is retained after a downgrade; new creation remains blocked by migration 004. An expired entitlement fails closed even if a webhook is delayed. Renewals therefore need working webhooks.

Server-only customer/session records and RPCs have no browser grants. Checkout accepts a plan name, never a client-supplied amount, Stripe customer, redirect URL, or user ID. The server reuses pending sessions and prevents creating another subscription when one already exists. Billing follows account ownership; team members pay for their own account, while workspace access inherits the workspace owner’s entitlement.

This implementation uses supported **hosted Stripe Checkout** (`ui_mode: hosted`, `mode: subscription`). The pasted preview `ui_mode: form` sample combined with `session.url` redirect has been replaced with the hosted redirect flow. No card details pass through Revbaze. API version is pinned to `2025-09-30.clover`.

CSV import, production integrations/webhooks, and priority-support delivery remain separate planned capabilities; purchasing an entitlement does not implement those features. Analytics/integrations currently display sample activity where already configured.

## Local checks

`npm test` includes real isolated PostgreSQL tests for protected billing grants, leases, duplicate-event handling, expiry, atomic plan changes, quotas, and pure billing tests for monthly-price validation, subscription state, and raw-body signature verification. `tests/onboarding-browser.py` checks upgrade/settings UI with mocked billing and never calls Stripe or the hosted database. No paid end-to-end transaction is claimed until the deployment/configuration steps above are completed.

## Checkout return navigation

`/#/upgrade` renders without waiting for a dashboard workspace fetch. Direct `/upgrade` and `/checkout` URLs normalize to the application's hash routes.

The server sets both return URLs to `/#/checkout`. Cancellation restores the validated local route where checkout started, preserving its query parameters. Completion shows a confirmation screen, polls authenticated account-plan access, and continues to Overview only when the selected plan is active. If verification takes more than a minute, the screen provides Check again and Back buttons. A success URL never grants access on its own. Existing pending sessions with outdated return URLs are expired and replaced before reuse.

## Paid checkout and signup

New Growth and Pro subscriptions charge $10/month or $29/month at checkout, with no free trial. Checkout collects payment details and the first payment before paid access is granted. Existing subscriptions retain their agreed terms, including previously started trials; existing subscribers manage changes through the customer portal. Pending checkout sessions configured with the old trial offer are expired and replaced when checkout is requested again.

Pricing carries the selected plan into signup and user metadata across email confirmation. Free proceeds directly to onboarding. Growth and Pro open `/start-plan` and redirect to hosted Stripe Checkout before onboarding. The return screen waits for server-verified entitlement before continuing; a redirect alone never grants access. Cancellation offers retry or Free instead.

Deploy with `supabase functions deploy billing`. No additional migration is needed. Keep the subscription, checkout, and invoice webhooks enabled. Test new Growth and Pro checkouts, cancellation, failed payment, and replacement of old trial checkout sessions using Stripe test mode.
