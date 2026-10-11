# PayMongo subscriptions

Revbaze advertises Growth at USD $10/month and Pro at USD $29/month. PayMongo subscription charges are PHP. Checkout converts the USD price using the daily ExchangeRate-API USD/PHP reference rate, rounds to centavos and displays the exact PHP amount before consent. It does not use the customer's bank's exchange rate or charge USD.

A private quote ledger records the USD price, PHP amount, rate, date, provider plan and test/live mode. Daily quotes generate PayMongo plans automatically. Existing paid periods are preserved during plan changes/cancellation. Access comes from verified current subscription/invoice state, not return URL parameters. No free trials are created.

## Deployment

1. Apply all migrations through `202610110032_paymongo_billing.sql`. Historical migration 005 stays in place for ordered database replay; 032 replaces its provider mapping and lease implementation. Private historical records remain for audit purposes.
2. Contact PayMongo to enable Subscriptions, Card Vaulting and supported payment methods on the merchant account before testing. Test and live mode are separate.
3. Set these **Edge Function secrets**, never `VITE_` variables:
   - `PAYMONGO_SECRET_KEY`: `sk_test_...` initially.
   - `PAYMONGO_PUBLIC_KEY`: matching `pk_test_...`; the authenticated payment setup response intentionally shares this public key with the browser.
   - `PAYMONGO_WEBHOOK_SECRET`: signing secret for this endpoint and mode.
   - `BILLING_RENEWAL_SECRET`: a separate random secret of at least 32 characters.
   - `APP_URL`: exact frontend origin; existing Supabase URL/service-role secrets are also required.
4. Deploy `billing`, `paymongo-webhook`, `billing-renewals` using the committed function configuration. Delete the previously deployed `stripe-webhook` function and disable its provider webhook. Remove unused `STRIPE_*` Edge secrets. Removing local source does not delete hosted functions or cancel provider subscriptions.
5. Register `https://PROJECT.supabase.co/functions/v1/paymongo-webhook` for all available subscription events, including `subscription.activated`, `subscription.updated`, `subscription.past_due`, `subscription.unpaid`, and `subscription.invoice.created`, `subscription.invoice.finalized`, `subscription.invoice.paid`, `subscription.invoice.payment_failed`, `subscription.invoice.updated`. Use event names supported by the merchant's enabled API. Register the webhook before accepting payments.
6. Store `revbaze_project_url` and `revbaze_billing_renewal_secret` in Supabase Vault. Run `scripts/schedule-billing-renewals.sql`. Monitor `failed` responses and the age of `billing_customers.fx_checked_at`.
7. The user confirmed that old subscriptions are test-only. After verifying that fact on the target project, an operator can run `select public.reset_legacy_test_billing();` to remove old test entitlements/pending state. This is intentionally separate from schema migration. Cancel/delete obsolete test subscriptions in the old provider dashboard. Real subscribers would require a separate migration and payment authorization; do not run this reset for them.

## Exchange rates and renewal behavior

The backend caches one USD/PHP reference rate per UTC day. A missing or stale (>36 hours) upstream quote blocks new pricing rather than guessing. Checkout reuses an existing incomplete subscription and honors its previously quoted amount.

The scheduled worker reconciles payment state, then updates active subscriptions to their tier's latest daily PHP plan. PayMongo applies plan changes at the next billing cycle; already-generated invoices are not retroactively repriced. Thus the renewal uses the quote installed before PayMongo prepares that invoice, not a guaranteed exact exchange rate at charge time. The payment screen discloses variable PHP renewals and requires consent. USD base prices remain unchanged.

The worker handles at most ten accounts per invocation, revisiting each after 24 hours; schedule every five minutes and monitor backlog as the subscriber count grows. Retry failed repricing/reconciliation; alert on stale FX rates, failed/disabled webhooks and overdue account checks. Configure hosted timeouts/batch size for measured API latency. Browser status checks also reconcile missed events, but do not replace the worker.

Daily FX plans are not customer-specific. Avoid provider-side edits to recorded prices. Test/live plan caches are separate. Use separate Supabase projects for test and production: customer mappings and entitlement tables should not mix modes. The backend checks invoice amount/currency, registered plan, recurrence and provider mode before granting access.

## Payment data and customer controls

Card details go directly from the browser to PayMongo's public-key payment-method API; they are not sent to Revbaze Edge Functions or persisted in browser storage. The temporary payment intent/client key is held in account-scoped sessionStorage. Clear browser state between accounts and use a tested CSP. This direct card form still requires appropriate PCI/security review; avoiding server card storage alone does not establish compliance.

Maya authorization and card 3DS redirect to the provider's returned HTTPS URL. Payment-method updates use a setup intent. Cancellation prevents future invoices while retaining an already verified paid period. Plan changes apply at the next billing cycle. Open invoices can remain collectible after cancellation; display/support and test that behavior with PayMongo.

## Required hosted acceptance tests

Run local tests/build/lint, then test the actual enabled merchant API: daily plan creation and cache reuse; first card/Maya authorization; 3DS rejection/retry; renewal; failed payment; payment-method replacement; next-cycle upgrade/downgrade; cancellation with an existing invoice; duplicate/delayed webhooks; function failure after subscription creation; FX outage; test/live mismatch; cron recovery and quote changes before invoice generation. Check current subscription plan/invoice shapes and setup-intent behavior on the enabled account. No live payment or remote deployment was performed during implementation.

References: [Subscriptions](https://docs.paymongo.com/docs/payment-acceptance-subscriptions), [Plan currency](https://docs.paymongo.com/reference/plan-resource), [Webhook authentication](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management), [Exchange rate endpoint](https://www.exchangerate-api.com/docs/free).
