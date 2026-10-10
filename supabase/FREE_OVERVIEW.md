# Free Overview access

Apply migration `202610090011_free_overview_access.sql` after migration 010.

Free accounts can see page views, outbound clicks, CTR, and the daily performance chart on Overview. Its server projection exposes only card-level daily counts for the last 180 days (enough for a 90-day comparison), without platform, visitor, or source details. Detailed Analytics and Top Review Platforms remain paid features.

Free includes one review platform per business and one enabled platform link per card. Existing destinations are retained; new additions are blocked, and saving a card requires reducing enabled links to one. Growth and Pro limits remain unchanged.
