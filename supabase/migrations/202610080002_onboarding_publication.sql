-- Apply after 202610080001_review_link_management.sql.
-- Reuse business/card tables; drafts are private and publication is atomic.
alter table public.businesses add column onboarding_completed_at timestamptz;
alter table public.review_cards add column published_at timestamptz;
create table public.onboarding_drafts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 business_id uuid not null default gen_random_uuid(), card_id uuid not null default gen_random_uuid(),
 draft jsonb not null default '{}', step integer not null default 1 check(step between 1 and 5),
 revision integer not null default 0, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(jsonb_typeof(draft)='object' and octet_length(draft::text)<=100000)
);
create unique index onboarding_one_pending_per_user on public.onboarding_drafts(user_id) where completed_at is null;
alter table public.onboarding_drafts enable row level security;
create policy onboarding_draft_read on public.onboarding_drafts for select to authenticated using(user_id=auth.uid());
revoke all on public.onboarding_drafts from anon,authenticated;
grant select on public.onboarding_drafts to authenticated;
grant all on public.onboarding_drafts to service_role;

create function public.onboarding_status() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('businesses',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'complete',b.onboarding_completed_at is not null,'owner',b.owner_id=auth.uid()) order by b.created_at) from public.businesses b where public.can_read_business(b.id)),'[]'::jsonb), 'draft', (select to_jsonb(d) from public.onboarding_drafts d where d.user_id=auth.uid() order by (d.completed_at is null) desc,d.updated_at desc limit 1))
$$;
create function public.begin_onboarding(p_new_business boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.onboarding_drafts; existing_business public.businesses; c public.review_cards; initial jsonb:='{}'; allocated_business uuid:=gen_random_uuid(); allocated_card uuid:=gen_random_uuid();
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select * into d from public.onboarding_drafts where user_id=auth.uid() and completed_at is null;
 if found then return to_jsonb(d); end if;
 if not p_new_business and exists(select 1 from public.businesses b where public.can_read_business(b.id) and b.onboarding_completed_at is not null) then
  select * into d from public.onboarding_drafts where user_id=auth.uid() and completed_at is not null order by updated_at desc limit 1;
  if found then return to_jsonb(d); end if;
  raise exception 'Onboarding is already complete. Start a new business explicitly.';
 end if;
 if not p_new_business then
  select * into existing_business from public.businesses where owner_id=auth.uid() and onboarding_completed_at is null order by created_at limit 1;
  if found then
   allocated_business:=existing_business.id;
   initial:=jsonb_build_object('business',to_jsonb(existing_business),'links',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at) from public.business_review_links l where l.business_id=existing_business.id and l.is_active),'[]'::jsonb));
   select * into c from public.review_cards where business_id=existing_business.id order by created_at limit 1;
   if found then allocated_card:=c.id; initial:=initial||jsonb_build_object('card',jsonb_build_object('slug',c.slug,'headline',c.headline,'description',c.description,'accent',c.appearance_settings->>'accent','button_style',c.appearance_settings->>'button_style','radius',c.appearance_settings->>'radius')); end if;
  end if;
 end if;
 insert into public.onboarding_drafts(user_id,business_id,card_id,draft) values(auth.uid(),allocated_business,allocated_card,initial) returning * into d;
 return to_jsonb(d);
end $$;
create function public.save_onboarding_draft(p_id uuid,p_draft jsonb,p_step integer,p_revision integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.onboarding_drafts; b jsonb;
begin
 select * into d from public.onboarding_drafts where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Draft access denied'; end if;
 if d.completed_at is not null then raise exception 'This onboarding has already been published'; end if;
 if d.revision<>p_revision then raise exception 'Draft changed in another tab. Reload to resume the latest saved version.'; end if;
 if p_step not between 1 and 4 then raise exception 'Invalid onboarding step'; end if;
 if jsonb_typeof(p_draft) is distinct from 'object' or octet_length(p_draft::text)>100000 then raise exception 'Invalid draft'; end if;
 b:=p_draft->'business';
 -- Create only this draft's allocated business, never overwrite an existing workspace.
 if length(trim(coalesce(b->>'name',''))) between 1 and 100 and length(trim(coalesce(b->>'category','')))>0 and (coalesce(b->>'website_url','')='' or public.valid_review_url('custom',b->>'website_url')) and public.check_logo_url(coalesce(b->>'logo_url','')) then
  if exists(select 1 from public.businesses where id=d.business_id and owner_id<>auth.uid()) then raise exception 'Business access denied'; end if;
  perform public.save_business(b || jsonb_build_object('id',d.business_id,'slug',coalesce((select slug from public.businesses where id=d.business_id),'workspace-'||replace(d.business_id::text,'-',''))));
  insert into public.business_members(business_id,user_id,role) values(d.business_id,auth.uid(),'admin') on conflict(business_id,user_id) do nothing;
 end if;
 update public.onboarding_drafts set draft=p_draft,step=p_step,revision=revision+1,updated_at=now() where id=d.id returning * into d;
 return to_jsonb(d);
end $$;
create function public.check_onboarding_slug(p_slug text,p_card_id uuid default null) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and p_slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' and not exists(select 1 from public.review_cards where slug=p_slug and id is distinct from p_card_id)
$$;
create function public.publish_onboarding(p_id uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.onboarding_drafts; b jsonb; c jsonb; item jsonb; order_index integer:=0; card_links jsonb:='[]'; link_id uuid; card public.review_cards;
begin
 select * into d from public.onboarding_drafts where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Draft access denied'; end if;
 if d.completed_at is not null then
  select * into card from public.review_cards where id=d.card_id;
  return jsonb_build_object('draft',to_jsonb(d),'card',to_jsonb(card));
 end if;
 if d.revision<>p_revision then raise exception 'Draft changed in another tab. Reload to resume the latest saved version.'; end if;
 b:=d.draft->'business'; c:=d.draft->'card';
 if d.step<>4 or length(trim(coalesce(d.draft->>'name','')))<1 or length(trim(coalesce(b->>'name','')))<1 or length(trim(coalesce(b->>'category','')))<1 then raise exception 'Complete your account and business information first'; end if;
 if not public.owns_business(d.business_id) then raise exception 'Business ownership required'; end if;
 perform public.save_business(b || jsonb_build_object('id',d.business_id,'slug',coalesce((select slug from public.businesses where id=d.business_id),'workspace-'||replace(d.business_id::text,'-',''))));
 if jsonb_typeof(d.draft->'links') is distinct from 'array' or jsonb_array_length(d.draft->'links') not between 1 and 20 then raise exception 'Add at least one valid review platform (maximum 20)'; end if;
 for item in select value from jsonb_array_elements(d.draft->'links') loop
  link_id:=(item->>'id')::uuid;
  perform public.save_review_link(item || jsonb_build_object('business_id',d.business_id,'is_active',true));
  card_links:=card_links||jsonb_build_array(jsonb_build_object('business_review_link_id',link_id,'display_order',order_index,'is_enabled',true));
  order_index:=order_index+1;
 end loop;
 if coalesce(c->>'slug','') in ('overview','signup','check-email','forgot-password','reset-password','review','admin','api','app','login','settings','cards','analytics','onboarding','platforms','qr-codes','profile','auth','support') then raise exception 'This URL is reserved'; end if;
 perform public.save_review_card(jsonb_build_object('id',d.card_id,'business_id',d.business_id,'name',b->>'name'||' review card','slug',c->>'slug','headline',c->>'headline','description',c->>'description','appearance_settings',jsonb_build_object('business_name',b->>'name','logo_url',coalesce(b->>'logo_url',''),'accent',c->>'accent','background','#ffffff','button_style',c->>'button_style','radius',c->>'radius'),'is_active',true,'links',card_links));
 update public.review_cards set published_at=now() where id=d.card_id returning * into card;
 update public.businesses set onboarding_completed_at=now() where id=d.business_id;
 update public.onboarding_drafts set completed_at=now(),step=5,revision=revision+1,updated_at=now() where id=d.id returning * into d;
 return jsonb_build_object('draft',to_jsonb(d),'card',to_jsonb(card));
end $$;
-- Anonymous access exposes only the explicit published customer-facing projection.
create function public.published_review_card(p_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',c.id,'slug',c.slug,'headline',c.headline,'description',c.description,'appearance_settings',jsonb_build_object('business_name',c.appearance_settings->>'business_name','logo_url',c.appearance_settings->>'logo_url','accent',c.appearance_settings->>'accent','background',c.appearance_settings->>'background','button_style',c.appearance_settings->>'button_style','radius',c.appearance_settings->>'radius'),
 'destinations',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'platform_id',l.platform_id,'display_name',l.display_name,'destination_url',l.destination_url) order by cl.display_order) from public.review_card_links cl join public.business_review_links l on l.id=cl.business_review_link_id where cl.review_card_id=c.id and cl.is_enabled and l.is_active),'[]'::jsonb))
 from public.review_cards c where c.slug=p_slug and c.is_active and c.published_at is not null
 and exists(select 1 from public.review_card_links cl join public.business_review_links l on l.id=cl.business_review_link_id where cl.review_card_id=c.id and cl.is_enabled and l.is_active)
$$;
revoke all on function public.onboarding_status(),public.begin_onboarding(boolean),public.save_onboarding_draft(uuid,jsonb,integer,integer),public.check_onboarding_slug(text,uuid),public.publish_onboarding(uuid,integer) from public,anon;
grant execute on function public.onboarding_status(),public.begin_onboarding(boolean),public.save_onboarding_draft(uuid,jsonb,integer,integer),public.check_onboarding_slug(text,uuid),public.publish_onboarding(uuid,integer) to authenticated;
revoke all on function public.published_review_card(text) from public;
grant execute on function public.published_review_card(text) to anon,authenticated;
