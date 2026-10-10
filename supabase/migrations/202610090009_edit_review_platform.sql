-- Keep historical click attribution when an existing destination changes provider.
alter table public.review_card_events add column platform_id text references public.review_platforms(id);
update public.review_card_events e set platform_id=l.platform_id from public.business_review_links l where l.id=e.business_review_link_id and e.event_type='outbound_click';
create function public.snapshot_event_platform() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.event_type='outbound_click' then select platform_id into new.platform_id from public.business_review_links where id=new.business_review_link_id; end if;
 return new;
end $$;
revoke all on function public.snapshot_event_platform() from public,anon,authenticated;
create trigger event_platform_snapshot before insert on public.review_card_events for each row execute function public.snapshot_event_platform();
-- Preserve destination IDs and card associations when editing platform type.
create or replace function public.save_review_link(p_link jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=(p_link->>'id')::uuid; v_business uuid:=(p_link->>'business_id')::uuid; existing public.business_review_links;
begin
 if not public.can_write_business(v_business) then raise exception 'Business access denied'; end if;
 perform 1 from public.businesses where id=v_business for update;
 select * into existing from public.business_review_links where id=v_id;
 if found and existing.business_id<>v_business then raise exception 'Destination access denied'; end if;
 if not public.valid_review_url(p_link->>'platform_id',p_link->>'destination_url') then raise exception 'Invalid HTTPS destination or platform domain'; end if;
 insert into public.business_review_links(id,business_id,platform_id,display_name,destination_url,is_active)
 values(v_id,v_business,p_link->>'platform_id',trim(p_link->>'display_name'),p_link->>'destination_url',(p_link->>'is_active')::boolean)
 on conflict(id) do update set platform_id=excluded.platform_id,display_name=excluded.display_name,destination_url=excluded.destination_url,is_active=excluded.is_active,updated_at=now();
 perform public.deactivate_empty_cards(v_business);
 insert into public.business_activity(business_id,action,metadata) values(v_business,case when existing.id is null then 'Review platform added' else 'Review platform updated' end,jsonb_build_object('name',p_link->>'display_name'));
 return v_id;
end $$;

-- Add attribution to the authenticated, plan-filtered analytics projection.
drop function public.workspace_visitor_events(uuid);
create function public.workspace_visitor_events(p_business_id uuid) returns table(id text,review_card_id uuid,event_type text,business_review_link_id uuid,referrer text,created_at timestamptz,count bigint,visitor_key text,traffic_source text,platform_id text)
language sql stable security definer set search_path=public as $$
 select md5(c.id::text||e.event_type||coalesce(e.business_review_link_id::text,'')||coalesce(e.referrer,'')||coalesce(e.visitor_key,'')||coalesce(e.traffic_source,'')||date_trunc('day',e.created_at at time zone 'Asia/Manila')::text),c.id,e.event_type,e.business_review_link_id,e.referrer,(date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila'),count(*),e.visitor_key,e.traffic_source,e.platform_id
 from public.review_card_events e join public.review_cards c on c.id=e.review_card_id
 where c.business_id=p_business_id and public.can_read_business(p_business_id) and public.can_read_plan_event(c.id,e.created_at)
 group by c.id,e.event_type,e.business_review_link_id,e.referrer,date_trunc('day',e.created_at at time zone 'Asia/Manila'),e.visitor_key,e.traffic_source,e.platform_id
 order by date_trunc('day',e.created_at at time zone 'Asia/Manila'),c.id,e.event_type,e.business_review_link_id,e.referrer,e.visitor_key,e.traffic_source
$$;
revoke all on function public.workspace_visitor_events(uuid) from public,anon;
grant execute on function public.workspace_visitor_events(uuid) to authenticated;
