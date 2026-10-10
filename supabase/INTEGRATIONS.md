# Integration setup

Apply `migrations/202610090010_integration_setup.sql` after migrations 001–009 using the Supabase SQL editor or your migration workflow.

The Integrations tab saves webhook configuration per business for Zapier, Make, n8n, and custom HTTPS endpoints. Only the business owner can read or change connection URLs; saving requires Growth or Pro. Removing a setup remains available after a downgrade.

These URLs can contain provider credentials. Do not paste them into chat or logs. Browser roles cannot write directly to the table.

This release configures connections only. It does not send tests, queue events, retry deliveries, sign requests, or authorize Slack/Mailchimp. The interface labels these limitations explicitly. Before enabling delivery, implement a server-side outbox and worker with URL/SSRF protections, request signatures, timeouts, retry limits, paid-plan checks, and delivery history. Never send arbitrary customer webhook requests from the browser.
