# Privacy and Terms implementation audit

Reviewed October 9, 2026. The public pages are detailed drafts, not finalized legal instruments. Their content is in `src/features/marketing/legalContent.ts`; `legalStatus.final` remains false. No new terms acceptance, tracking consent, account-deletion workflow, refund workflow, or retention job was introduced by this change.

## Confirm before finalizing

- Legal operator's full name, address, country/jurisdiction, privacy contact, and responsible contact workflow.
- Applicable processing purposes and legal bases; whether Revbaze is a controller or processor in each context; any required business data-processing agreement.
- Customer locations, eligibility/age rules, transfer safeguards, Supabase project and other provider regions, and log/backup retention.
- Account, event, contact, public-asset, billing, activity, and backup retention schedules. Implement deletion/cleanup before promising deadlines.
- Whether visitor analytics require prior consent/opt-out in target locations; current code tracks public-card views without a consent management layer.
- Refund policy, contractual change notices, suspension/termination procedures, consumer rights, applicable law, dispute handling, and liability provisions. Review final text with qualified counsel for the regions served.
- PayMongo portal cancellation and plan-change settings. Upgrades may invoice immediately and subscription changes during a trial must be tested. Terms deliberately do not promise that every plan change preserves a trial.
- Contact intake is private Supabase storage only. Establish administrator access and a response process for rights requests; successful delivery is not a completed privacy request.
- Signup currently has no versioned terms-acceptance record. Privacy notice display is not itself consent.

## Evidence in the application

| Area | Implementation | Disclosure |
| --- | --- | --- |
| Authentication | `src/lib/supabase.ts`, `features/auth/AuthPage.tsx` | Supabase account/session storage, confirmation/reset, pending email session storage |
| Profile/preferences | `features/settings/AccountPreferences.tsx`, `stores/preferences.ts` | Optional name/image, local preferences, notification preferences without delivery |
| Public media | migration `202610080001`, `services/workspace.ts` | Both business-assets and profile-assets public; replacing/deleting card does not remove image uploads |
| Publication | migrations `202610080002`, `202610090007`, `202610090013` | Private drafts, intentional public card projection, server-enforced downgrade availability |
| Event collection | `services/reviewEvents.ts`, `functions/review-events/index.ts`, migration `202610090008` | Persistent random browser identifier, business-scoped HMAC, timestamps/click destination, referrer hostname and source |
| Analytics access | migrations `202610090011`, `202610090012`, `202610090013` | 180-day Free totals, 12/24-month paid read windows; not deletion schedules |
| QR designs | `components/onboarding/QRCustomizer.tsx` | Browser-local settings and downloads; QR destinations link to public cards |
| Workspace export | `features/settings/SettingsPage.tsx` | Current loaded workspace only, not complete data-access export |
| Billing | `functions/billing/index.ts`, `_shared/billing-core.ts`, `paymongo-webhook`, migration `202610090005` | Hosted PayMongo checkout; customer/subscription state; new subscriptions charge at checkout; existing subscription terms preserved; server verification |
| Cancellation | migration `202610090013` | Data preserved, excess items unavailable, user choices within Free limits, restore within new plan quota |
| Integration setup | migration `202610090010` | Provider/destination/event configuration, not automatic event delivery |
| Contact | migration `202610090014`, `functions/contact-message/index.ts` | Private name/email/topic/message/time; hashed source limits; older limit buckets removed on successful submissions, not timer |
| Fonts | `src/index.css` | Google Fonts network requests |
| Deletion | card/link RPCs, Settings Data | Card/link deletion available; no self-service account closure; no general cleanup/retention worker |

No advertising pixels, review-text/rating aggregation, geo/device collection in the event ingress, or data-sale mechanism were found in audited app code. Provider infrastructure can still process IP/user-agent/log data. Do not turn absence in app code into an unverified company-wide guarantee.

## Reference guidance

- National Privacy Commission, right to be informed: https://privacy.gov.ph/the-right-to-be-informed/ (scope, purpose, recipients, operator details, retention, rights). Consulted as notice-design guidance, not an assertion that Philippine law is the only applicable law.
- PayMongo hosted checkout trials: https://docs.paymongo.com/docs/payment-acceptance-subscriptions
- Provider notices: https://supabase.com/privacy, https://paymongo.com/privacy, https://developers.google.com/fonts/faq/privacy

The new pages remove the old inaccurate claims that all analytics are sample-only, integrations only show samples, and billing is disabled. Marketing copy elsewhere contains older preview wording; it was not changed as part of the legal-page scope.

## Operator choices received

- Currently individually operated; company registration planned. Do not describe a registered entity before it exists.
- International customer audience. This does not identify the operator’s country of establishment.
- Account eligibility: at least 18 years old. No age-verification or attestation feature was added by this content update.
- Refund requests within seven days of a charge. Coverage confirmed: first subscription charge only, excluding renewals/subsequent charges. The window starts on the actual first subscription charge. PayMongo refunds require an operator action or a separately implemented server workflow.
- Inactive-account retention target: two years. Define inactivity and implement measured cleanup, notices/handling, public storage removal, provider records/backups and required retention exceptions before claiming automatic enforcement. Cancellation alone is not inactivity; active Free users must not be deleted merely because they have no subscription.
- Business name supplied: Revbaze Inc. Operating country confirmed: Philippines; international customers. Earlier registration-pending status remains in the draft. Still needed: registration status/address, formal contact choice, contact-message retention.

The seven-day refund policy is an operator commitment, not an automatic PayMongo setting. No refunds were issued and no billing automation was changed by this content update.

PayMongo follow-up: current checkout sends card details directly from the browser to PayMongo, supports card/Maya subscriptions, and requires variable PHP renewal consent for the USD base price. The quoted daily reference rate is provided by ExchangeRate-API. Plan changes apply next cycle; hosted API behavior and payment compliance require acceptance review before launch.
