# Downgrade access

Apply `migrations/202610090013_downgrade_access.sql` after 001–012 in Supabase SQL Editor, once. No Edge Function deployment is required for these changes.

Availability is computed using the current, unexpired owner entitlement on every public request. Scheduled cancellation preserves paid access until the entitlement ends. No scheduler or browser setting can extend access. Free permits one business, one card, and one enabled public destination. Growth permits two businesses and five cards; Pro restores all saved items. Existing manually inactive cards stay inactive.

Until an owner chooses items in Settings → Plans & billing, the oldest business and card are used as deterministic defaults. The selected business/card/destination are prioritized when they exist. Selections are validated as belonging together to the signed-in owner and serialized with entitlement changes. Saved selections never grant paid access. Public projection, paused-item writes, and detailed analytics are enforced by database functions/triggers. Authenticated users have no writes to the selection table or access to the unrestricted projection.

All saved settings and activation flags remain intact. Paused workspaces/cards stay readable for account management; their public projections are unavailable. Old generated QR codes cannot be erased from devices: their destinations follow current server access. Free QR editing remains basic via existing plan controls. Integration delivery is still not implemented; a future delivery worker must check current owner entitlements and workspace availability before sending.

Run `npm test` for server ownership, public projection, expiration, quotas, selection and restoration tests.
