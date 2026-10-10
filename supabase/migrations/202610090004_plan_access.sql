-- Apply after 001–003. No payment provider is connected by this migration.
-- Plans belong to account owners. Team members inherit the workspace owner's access.
create table public.account_plans (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null default 'free' check(plan in ('free','growth','pro')),
 expires_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.account_plans enable row level security;
create policy account_plan_read on public.account_plans for select to authenticated using(user_id=auth.uid());
revoke all on public.account_plans from public,anon,authenticated;
grant select on public.account_plans to authenticated;
grant all on public.account_plans to service_role;

create function public.effective_account_plan(p_owner uuid) returns text language sql stable security definer set search_path=public as $$
 select coalesce((select plan from public.account_plans where user_id=p_owner and (expires_at is null or expires_at>now())),'free')
$$;
-- Internal helper, never callable by browser roles.
revoke all on function public.effective_account_plan(uuid) from public,anon,authenticated;

create function public.account_plan_status(p_business_id uuid default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare workspace_owner uuid:=auth.uid();
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_business_id is not null then
  if not public.can_read_business(p_business_id) then raise exception 'Business access denied'; end if;
  select owner_id into workspace_owner from public.businesses where id=p_business_id;
 end if;
 return jsonb_build_object('plan',public.effective_account_plan(auth.uid()),'workspace_plan',public.effective_account_plan(workspace_owner),
 'businesses',(select count(*) from public.businesses where owner_id=auth.uid()),
 'workspace_cards',(select count(*) from public.review_cards c join public.businesses b on b.id=c.business_id where b.owner_id=workspace_owner),
 'cards',(select count(*) from public.review_cards c join public.businesses b on b.id=c.business_id where b.owner_id=auth.uid()));
end $$;
revoke all on function public.account_plan_status(uuid) from public,anon;
grant execute on function public.account_plan_status(uuid) to authenticated;

create function public.enforce_plan_limits() returns trigger language plpgsql security definer set search_path=public as $$
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
  if current_count>=3 then raise exception 'Free allows 3 enabled review platform links per card. Choose fewer links or upgrade.'; end if;
 end if;
 return new;
end $$;
revoke all on function public.enforce_plan_limits() from public,anon,authenticated;
create trigger business_plan_limit before insert or update on public.businesses for each row execute function public.enforce_plan_limits();
create trigger card_plan_limit before insert or update on public.review_cards for each row execute function public.enforce_plan_limits();
create trigger card_link_plan_limit before insert or update on public.review_card_links for each row execute function public.enforce_plan_limits();

-- Serialize trusted entitlement changes with creation limits; browsers have no write grant.
create function public.lock_account_plan() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(coalesce(new.user_id,old.user_id)::text,4));
 if tg_op='DELETE' then return old; end if;
 new.updated_at:=now(); return new;
end $$;
revoke all on function public.lock_account_plan() from public,anon,authenticated;
create trigger account_plan_lock before insert or update or delete on public.account_plans for each row execute function public.lock_account_plan();

create function public.can_read_plan_event(p_card uuid,p_created timestamptz) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.review_cards c join public.businesses b on b.id=c.business_id where c.id=p_card and public.can_read_business(b.id)
 and case public.effective_account_plan(b.owner_id) when 'growth' then p_created>=now()-interval '12 months' when 'pro' then p_created>=now()-interval '24 months' else false end)
$$;
revoke all on function public.can_read_plan_event(uuid,timestamptz) from public,anon;
grant execute on function public.can_read_plan_event(uuid,timestamptz) to authenticated;
drop policy events_read on public.review_card_events;
create policy events_read on public.review_card_events for select to authenticated using(public.can_read_plan_event(review_card_id,created_at));

create or replace function public.workspace_events(p_business_id uuid) returns table(id text,review_card_id uuid,event_type text,business_review_link_id uuid,referrer text,created_at timestamptz,count bigint) language sql stable security definer set search_path=public as $$
 select md5(c.id::text||e.event_type||coalesce(e.business_review_link_id::text,'')||coalesce(e.referrer,'')||(date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila')::text),c.id,e.event_type,e.business_review_link_id,e.referrer,(date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila'),count(*)
 from public.review_card_events e join public.review_cards c on c.id=e.review_card_id where c.business_id=p_business_id and public.can_read_business(p_business_id) and public.can_read_plan_event(c.id,e.created_at)
 group by c.id,e.event_type,e.business_review_link_id,e.referrer,(date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila') order by (date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila'),c.id,e.event_type,e.business_review_link_id,e.referrer
$$;

