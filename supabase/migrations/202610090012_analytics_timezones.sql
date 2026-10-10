-- Group paid analytics in the chosen IANA timezone, before aggregation.
-- Existing Manila RPCs and Free Overview remain unchanged.
create or replace function public.workspace_timezone_events(p_business_id uuid, p_timezone text default 'Asia/Manila')
returns table(id text,review_card_id uuid,event_type text,business_review_link_id uuid,referrer text,created_at timestamptz,count bigint,visitor_key text,traffic_source text,platform_id text)
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid reporting timezone'; end if;
 if not public.can_read_business(p_business_id) then raise exception 'Business access denied'; end if;
 return query
 select md5(c.id::text||e.event_type||coalesce(e.business_review_link_id::text,'')||coalesce(e.referrer,'')||coalesce(e.visitor_key,'')||coalesce(e.traffic_source,'')||coalesce(e.platform_id,'')||p_timezone||date_trunc('day',e.created_at at time zone p_timezone)::text),
 c.id,e.event_type,e.business_review_link_id,e.referrer,(date_trunc('day',e.created_at at time zone p_timezone) at time zone p_timezone),count(*),e.visitor_key,e.traffic_source,e.platform_id
 from public.review_card_events e join public.review_cards c on c.id=e.review_card_id
 where c.business_id=p_business_id and public.can_read_plan_event(c.id,e.created_at)
 group by c.id,e.event_type,e.business_review_link_id,e.referrer,date_trunc('day',e.created_at at time zone p_timezone),e.visitor_key,e.traffic_source,e.platform_id
 order by date_trunc('day',e.created_at at time zone p_timezone),c.id,e.event_type,e.business_review_link_id,e.referrer,e.visitor_key,e.traffic_source,e.platform_id;
end $$;
revoke all on function public.workspace_timezone_events(uuid,text) from public,anon;
grant execute on function public.workspace_timezone_events(uuid,text) to authenticated;
