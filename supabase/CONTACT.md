# Contact inbox

The Contact page saves submissions to `public.contact_messages`. It does not send emails. The inbox has row-level security and no anonymous or authenticated-user access. Read it through the Supabase dashboard or a future server-side admin endpoint with explicit administrator authorization. Do not give dashboard users direct table grants.

## Deployment status

On October 9, 2026, the linked project’s `contact-message` function was deployed and verified against the existing private inbox schema. Allowed origins are currently `http://localhost:5173` and `http://127.0.0.1:5173`. Add the production website origin before launching there. A live test submission and duplicate retry both succeeded; the test message was removed.

## Enable submissions

1. Apply `supabase/migrations/202610090014_contact_messages.sql` to your Supabase project.
2. Set `CONTACT_ALLOWED_ORIGINS` as a server-side secret containing your exact website origins, separated by commas (for example `https://revbaze.com,https://www.revbaze.com`). Include `http://localhost:5173` only if local development should submit to this project. `APP_URL` is used as a fallback.
3. Deploy the function: `supabase functions deploy contact-message`.
4. Open Contact and submit a message. Confirm the success state and the corresponding row in `contact_messages`.

The function uses the Supabase-provided service role secret; it must never be added to browser environment variables. Database failures display an error and preserve the form. Retries with an unchanged form use the same submission UUID to avoid duplicates.

## Abuse controls and data

Server-side field lengths, topic validation, a honeypot, bounded request bodies, and atomic five-submission hourly limits per email and source hash are enforced. Source addresses are HMAC hashed; raw addresses are not stored. Verify the deployment gateway's forwarding-header behavior before relying on source limits. Origin checks and a honeypot do not prevent determined automated abuse; add a server-verified CAPTCHA or gateway throttling if necessary.

Messages contain name, email, topic, message and creation time. Rate-limit records expire after two days and are cleaned during successful submissions. Choose a retention policy for messages when building the admin analytics. Do not expose message contents in public analytics.

Validation: `node tests/contact.test.mjs` checks private inbox permissions, persistence, idempotent retries, topic validation, hourly limiting, and reset behavior.
