-- Existing event SELECT policies enforce workspace membership and plan history.
-- Realtime delivers only rows the authenticated subscriber may read.
do $$
begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  create publication supabase_realtime;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='review_card_events') then
  alter publication supabase_realtime add table public.review_card_events;
 end if;
end $$;
