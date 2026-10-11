-- Private, shared counters: limits apply across all Edge instances.
create table public.request_limits (
 bucket text primary key, window_start timestamptz not null, requests integer not null
);
alter table public.request_limits enable row level security;
revoke all on public.request_limits from public,anon,authenticated;
grant all on public.request_limits to service_role;
create function public.allow_tracking_request(p_source text,p_slug text,p_session text default null) returns boolean
language plpgsql security definer set search_path=public as $$
declare entry record; used integer; allowed boolean:=true;
begin
 if p_source !~ '^[0-9a-f]{64}$' or length(p_slug)>60 then return false; end if;
 -- All requests consume counters, including rejects. Do not raise/roll back counters.
 for entry in select * from (values
  ('global',10000), ('card:'||p_slug,3000), ('source:'||p_source,120),
  ('caller-card:'||p_source||':'||p_slug,40),
  ('session:'||coalesce(p_session,p_source||':'||p_slug),20)
 ) v(key,cap) order by key loop
  insert into public.request_limits values(entry.key,date_trunc('minute',now()),1)
  on conflict(bucket) do update set
   requests=case when request_limits.window_start<>date_trunc('minute',now()) then 1 else request_limits.requests+1 end,
   window_start=date_trunc('minute',now()) returning requests into used;
  if used>entry.cap then allowed:=false; end if;
 end loop;
 return allowed;
end $$;
revoke all on function public.allow_tracking_request(text,text,text) from public,anon,authenticated;
grant execute on function public.allow_tracking_request(text,text,text) to service_role;
-- Keep the ingestion validator/idempotency, with a larger final backstop.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.ingest_review_event(uuid,uuid,text,uuid,text)'::regprocedure);
 definition:=replace(definition,')>=120',')>=3000');
 execute definition;
end $$;
create function public.cleanup_request_limits() returns void language sql security definer set search_path=public as $$
 delete from public.request_limits where bucket in (select bucket from public.request_limits where window_start<now()-interval '2 days' limit 5000)
$$;
revoke all on function public.cleanup_request_limits() from public,anon,authenticated;
grant execute on function public.cleanup_request_limits() to service_role;
