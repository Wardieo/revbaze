-- Free Overview exposes daily totals only, without visitor/source/platform data.
create function public.free_overview_events(p_business_id uuid) returns table(id text,review_card_id uuid,event_type text,created_at timestamptz,count bigint) language sql stable security definer set search_path=public as $$
 select md5(c.id::text||e.event_type||date_trunc('day',e.created_at at time zone 'Asia/Manila')::text),c.id,e.event_type,date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila',count(*)
 from public.review_card_events e join public.review_cards c on c.id=e.review_card_id join public.businesses b on b.id=c.business_id
 where c.business_id=p_business_id and public.can_read_business(p_business_id) and public.effective_account_plan(b.owner_id)='free' and e.created_at>=now()-interval '180 days'
 group by c.id,e.event_type,date_trunc('day',e.created_at at time zone 'Asia/Manila')
$$;
revoke all on function public.free_overview_events(uuid) from public,anon;
grant execute on function public.free_overview_events(uuid) to authenticated;
create or replace function public.enforce_plan_limits() returns trigger language plpgsql security definer set search_path=public as $$
declare account_owner uuid; tier text; limit_count integer; current_count integer;
begin
 if tg_table_name='businesses' then account_owner:=new.owner_id;
 elsif tg_table_name='review_cards' then select owner_id into account_owner from public.businesses where id=new.business_id;
 else select b.owner_id into account_owner from public.review_cards c join public.businesses b on b.id=c.business_id where c.id=new.review_card_id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(account_owner::text,4));
 tier:=public.effective_account_plan(account_owner);
 if tg_table_name='businesses' then
  if tg_op='UPDATE' and new.owner_id is distinct from old.owner_id then raise exception 'Business ownership cannot be changed'; end if;
  if not exists(select 1 from public.businesses where id=new.id) then
   limit_count:=case tier when 'free' then 1 when 'growth' then 2 else null end;
   select count(*) into current_count from public.businesses where owner_id=account_owner;
   if current_count>=limit_count then raise exception '% plan business limit reached (%). Upgrade your plan before adding another business.',initcap(tier),limit_count; end if;
  end if;
 elsif tg_table_name='review_cards' then
  if tg_op='UPDATE' and new.business_id is distinct from old.business_id then raise exception 'Card workspace cannot be changed'; end if;
  if not exists(select 1 from public.review_cards where id=new.id) then
   limit_count:=case tier when 'free' then 1 when 'growth' then 5 else null end;
   select count(*) into current_count from public.review_cards c join public.businesses b on b.id=c.business_id where b.owner_id=account_owner;
   if current_count>=limit_count then raise exception '% plan review card limit reached (%). Upgrade your plan before adding another card.',initcap(tier),limit_count; end if;
  end if;
 elsif tier='free' and new.is_enabled then
  select count(*) into current_count from public.review_card_links where review_card_id=new.review_card_id and is_enabled and business_review_link_id<>new.business_review_link_id;
  if current_count>=1 then raise exception 'Free allows 1 enabled review platform links per card. Choose fewer links or upgrade.'; end if;
 end if;
 return new;
end $$;

create function public.limit_free_review_destinations() returns trigger language plpgsql security definer set search_path=public as $$
declare owner uuid;
begin
 select owner_id into owner from public.businesses where id=new.business_id;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,4));
 if public.effective_account_plan(owner)='free' and exists(select 1 from public.business_review_links where business_id=new.business_id and id<>new.id) then raise exception 'Free allows 1 review platform per business. Upgrade to add another.'; end if;
 return new;
end $$;
revoke all on function public.limit_free_review_destinations() from public,anon,authenticated;
create trigger free_destination_limit before insert on public.business_review_links for each row execute function public.limit_free_review_destinations();
