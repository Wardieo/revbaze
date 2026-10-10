-- Browser IDs are hashed per business at ingress; no IPs or identity data.
alter table public.review_card_events add column visitor_key text;
alter table public.review_card_events add column traffic_source text;
alter table public.review_card_events add constraint event_visitor_key_format check(visitor_key is null or visitor_key ~ '^[0-9a-f]{64}$');
create function public.ingest_visitor_event(p_id uuid,p_card_id uuid,p_type text,p_link_id uuid default null,p_referrer text default null,p_visitor_key text default null,p_source text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 if p_source is not null and (length(p_source)>80 or p_source !~ '^[a-z0-9][a-z0-9 _.-]*$') then raise exception 'Invalid source'; end if;
 perform public.ingest_review_event(p_id,p_card_id,p_type,p_link_id,p_referrer);
 update public.review_card_events set visitor_key=p_visitor_key,traffic_source=p_source where id=p_id and review_card_id=p_card_id and visitor_key is null;
end $$;
revoke all on function public.ingest_visitor_event(uuid,uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.ingest_visitor_event(uuid,uuid,text,uuid,text,text,text) to service_role;
create function public.workspace_visitor_events(p_business_id uuid) returns table(id text,review_card_id uuid,event_type text,business_review_link_id uuid,referrer text,created_at timestamptz,count bigint,visitor_key text,traffic_source text)
language sql stable security definer set search_path=public as $$
 select md5(c.id::text||e.event_type||coalesce(e.business_review_link_id::text,'')||coalesce(e.referrer,'')||coalesce(e.visitor_key,'')||coalesce(e.traffic_source,'')||date_trunc('day',e.created_at at time zone 'Asia/Manila')::text),c.id,e.event_type,e.business_review_link_id,e.referrer,(date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila'),count(*),e.visitor_key,e.traffic_source
 from public.review_card_events e join public.review_cards c on c.id=e.review_card_id
 where c.business_id=p_business_id and public.can_read_business(p_business_id) and public.can_read_plan_event(c.id,e.created_at)
 group by c.id,e.event_type,e.business_review_link_id,e.referrer,date_trunc('day',e.created_at at time zone 'Asia/Manila'),e.visitor_key,e.traffic_source
 order by date_trunc('day',e.created_at at time zone 'Asia/Manila'),c.id,e.event_type,e.business_review_link_id,e.referrer,e.visitor_key,e.traffic_source
$$;
revoke all on function public.workspace_visitor_events(uuid) from public,anon;
grant execute on function public.workspace_visitor_events(uuid) to authenticated;
