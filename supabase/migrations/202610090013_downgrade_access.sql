-- Non-destructive entitlement projection. Never overwrite user activation/settings.
create table public.free_plan_selection (
 user_id uuid primary key references auth.users(id) on delete cascade,
 business_id uuid references public.businesses(id) on delete set null,
 card_id uuid references public.review_cards(id) on delete set null,
 link_id uuid references public.business_review_links(id) on delete set null
);
alter table public.free_plan_selection enable row level security;
revoke all on public.free_plan_selection from public,anon,authenticated;
grant all on public.free_plan_selection to service_role;

create function public.plan_business_available(p_business uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from (
 select b.id,row_number() over(order by (b.id=s.business_id) desc nulls last,b.created_at,b.id) position,
 public.effective_account_plan(b.owner_id) tier
 from public.businesses b left join public.free_plan_selection s on s.user_id=b.owner_id
 where b.owner_id=(select owner_id from public.businesses where id=p_business)
 ) ranked where id=p_business and (tier='pro' or position<=case tier when 'growth' then 2 else 1 end))
$$;
create function public.plan_card_available(p_card uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from (
 select c.id,row_number() over(order by (c.id=s.card_id) desc nulls last,c.created_at,c.id) position,
 public.effective_account_plan(b.owner_id) tier
 from public.review_cards c join public.businesses b on b.id=c.business_id left join public.free_plan_selection s on s.user_id=b.owner_id
 where b.owner_id=(select b2.owner_id from public.review_cards c2 join public.businesses b2 on b2.id=c2.business_id where c2.id=p_card)
 and public.plan_business_available(b.id)
 ) ranked where id=p_card and (tier='pro' or position<=case tier when 'growth' then 5 else 1 end))
$$;
create function public.plan_link_available(p_card uuid,p_link uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from (
 select cl.business_review_link_id,row_number() over(order by (l.id=s.link_id) desc nulls last,cl.display_order,l.id) position,public.effective_account_plan(b.owner_id) tier
 from public.review_card_links cl join public.business_review_links l on l.id=cl.business_review_link_id join public.review_cards c on c.id=cl.review_card_id join public.businesses b on b.id=c.business_id left join public.free_plan_selection s on s.user_id=b.owner_id
 where c.id=p_card and cl.is_enabled and l.is_active
 ) ranked where business_review_link_id=p_link and (tier<>'free' or position=1))
$$;
revoke all on function public.plan_business_available(uuid),public.plan_card_available(uuid),public.plan_link_available(uuid,uuid) from public,anon,authenticated;

-- Reuse the publication checks, filter the public output through current entitlements.
alter function public.published_review_card(text) rename to published_review_card_before_plan_limits;
revoke all on function public.published_review_card_before_plan_limits(text) from public,anon,authenticated;
create function public.published_review_card(p_slug text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 result:=public.published_review_card_before_plan_limits(p_slug);
 if result is null or not public.plan_card_available((result->>'id')::uuid) then return null; end if;
 result:=jsonb_set(result,'{destinations}',coalesce((select jsonb_agg(d.value order by d.ordinality) from jsonb_array_elements(result->'destinations') with ordinality d where public.plan_link_available((result->>'id')::uuid,(d.value->>'id')::uuid)),'[]'::jsonb));
 if jsonb_array_length(result->'destinations')=0 then return null; end if;
 return result;
end $$;
revoke all on function public.published_review_card(text) from public;
grant execute on function public.published_review_card(text) to anon,authenticated;

create function public.downgrade_access_status() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('plan',public.effective_account_plan(auth.uid()),
 'businesses',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'available',public.plan_business_available(b.id)) order by b.created_at,b.id) from public.businesses b where b.owner_id=auth.uid()),'[]'::jsonb),
 'cards',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'business_id',c.business_id,'name',c.name,'available',public.plan_card_available(c.id),'active',c.is_active) order by c.created_at,c.id) from public.review_cards c join public.businesses b on b.id=c.business_id where b.owner_id=auth.uid()),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'business_id',l.business_id,'name',l.display_name,'card_id',cl.review_card_id,'available',public.plan_link_available(cl.review_card_id,l.id))) from public.review_card_links cl join public.business_review_links l on l.id=cl.business_review_link_id join public.businesses b on b.id=l.business_id where b.owner_id=auth.uid() and cl.is_enabled and l.is_active),'[]'::jsonb)) where auth.uid() is not null
$$;
create function public.select_free_plan_items(p_business uuid,p_card uuid,p_link uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,4));
 if public.effective_account_plan(auth.uid())<>'free' then raise exception 'Free selection is available after your paid access ends'; end if;
 if not exists(select 1 from public.businesses where id=p_business and owner_id=auth.uid())
 or not exists(select 1 from public.review_cards where id=p_card and business_id=p_business)
 or not exists(select 1 from public.review_card_links cl join public.business_review_links l on l.id=cl.business_review_link_id where cl.review_card_id=p_card and l.business_id=p_business and l.id=p_link and cl.is_enabled and l.is_active) then raise exception 'Choose your own business, card and an enabled destination'; end if;
 insert into public.free_plan_selection values(auth.uid(),p_business,p_card,p_link) on conflict(user_id) do update set business_id=excluded.business_id,card_id=excluded.card_id,link_id=excluded.link_id;
end $$;
revoke all on function public.downgrade_access_status(),public.select_free_plan_items(uuid,uuid,uuid) from public,anon;
grant execute on function public.downgrade_access_status(),public.select_free_plan_items(uuid,uuid,uuid) to authenticated;
grant execute on function public.published_review_card(text) to service_role;

create function public.guard_paused_items() returns trigger language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
 if tg_table_name='businesses' then
  if not public.plan_business_available(new.id) then raise exception 'This business is paused by your plan. Restore access or choose it for Free before editing.'; end if;
 elsif tg_table_name='review_cards' then
  if not public.plan_card_available(new.id) then raise exception 'This review card is paused by your plan. Restore access or choose it for Free before editing.'; end if;
 elsif tg_table_name in ('business_review_links','integration_connections') then
  if not public.plan_business_available(new.business_id) then raise exception 'This business is paused by your plan'; end if;
 else
  target:=new.review_card_id;
  if not public.plan_card_available(target) then raise exception 'This review card is paused by your plan'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_paused_items() from public,anon,authenticated;
create trigger paused_business_guard before update on public.businesses for each row execute function public.guard_paused_items();
create trigger paused_card_guard before update on public.review_cards for each row execute function public.guard_paused_items();
create trigger paused_destination_guard before insert or update on public.business_review_links for each row execute function public.guard_paused_items();
create trigger paused_card_link_guard before insert or update on public.review_card_links for each row execute function public.guard_paused_items();

create or replace function public.can_read_plan_event(p_card uuid,p_created timestamptz) returns boolean language sql stable security definer set search_path=public as $$
 select public.plan_card_available(p_card) and exists(select 1 from public.review_cards c join public.businesses b on b.id=c.business_id where c.id=p_card and public.can_read_business(b.id)
 and case public.effective_account_plan(b.owner_id) when 'growth' then p_created>=now()-interval '12 months' when 'pro' then p_created>=now()-interval '24 months' else false end)
$$;

create trigger paused_integration_guard before insert or update on public.integration_connections for each row execute function public.guard_paused_items();
