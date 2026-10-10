-- Additive product pivot: does not drop or modify any legacy tables.
create table public.businesses (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 100), slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
 description text not null default '', logo_url text not null default '', website_url text not null default '', category text not null default '',
 contact_email text not null default '', brand_color text not null default '#4b7fe7' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index businesses_owner_idx on public.businesses(owner_id);
create table public.business_members (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, role text not null check (role in ('admin','editor','viewer')),
 created_at timestamptz not null default now(), unique(business_id,user_id)
);
create index business_members_user_idx on public.business_members(user_id);
create table public.review_platforms (
 id text primary key, name text not null, slug text unique not null, icon text not null, allowed_domains text[] not null default '{}', created_at timestamptz not null default now()
);
insert into public.review_platforms(id,name,slug,icon,allowed_domains) values
 ('google','Google Reviews','google','G',array['google.com','g.page','maps.app.goo.gl']),
 ('facebook','Facebook','facebook','f',array['facebook.com']),('trustpilot','Trustpilot','trustpilot','star',array['trustpilot.com']),
 ('yelp','Yelp','yelp','asterisk',array['yelp.com']),('g2','G2','g2','G2',array['g2.com']),('capterra','Capterra','capterra','triangle',array['capterra.com']),
 ('tripadvisor','Tripadvisor','tripadvisor','owl',array['tripadvisor.com']),('product-hunt','Product Hunt','product-hunt','P',array['producthunt.com']),
 ('app-store','App Store','app-store','A',array['apps.apple.com']),('google-play','Google Play Store','google-play','play',array['play.google.com']),
 ('custom','Custom review URL','custom','link','{}');

-- Both the browser and database validate destinations; this database check is authoritative.
create function public.valid_review_url(p_platform text, p_url text) returns boolean language plpgsql stable set search_path=public as $$
declare host text; domains text[]; authority text;
begin
 if p_url is null or p_url !~ '^https://' or p_url ~ '[[:space:]\\]' or length(p_url)>2048 then return false; end if;
 authority:=substring(p_url from '^https://([^/?#]+)');
 if authority is null or authority ~ '[@%]' then return false; end if;
 if authority ~ ':' and authority !~ ':443$' then return false; end if;
 host:=lower(regexp_replace(authority,':443$',''));
 if host !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$' or host ~ '\.(localhost|local|internal|test|invalid)$' then return false; end if;
 select allowed_domains into domains from public.review_platforms where id=p_platform;
 if not found then return false; end if;
 if p_platform='custom' then return true; end if;
 if p_url ~* '^https://[^/]+/(url|redirect|l\.php|away)/?([?#]|$)' or p_url ~* '[?&](url|q|u|redirect|redirect_url|redirect_uri|next|continue|returnurl)=(https?:|https?%3a)' then return false; end if;
 return exists(select 1 from unnest(domains) d where host=d or right(host,length(d)+1)='.'||d);
end $$;
create table public.business_review_links (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 platform_id text not null references public.review_platforms(id), display_name text not null check(length(trim(display_name)) between 1 and 80),
 destination_url text not null check(public.valid_review_url(platform_id,destination_url)), is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index business_review_links_business_idx on public.business_review_links(business_id);
create table public.review_cards (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), slug text unique not null check(slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' and slug not in ('admin','api','app','login','settings','cards','analytics','onboarding','platforms','qr-codes','profile','auth','support')),
 headline text not null check(length(trim(headline)) between 1 and 120), description text not null default '' check(length(description)<=500),
 appearance_settings jsonb not null default '{}', is_active boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(coalesce(appearance_settings->>'accent','') ~ '^#[0-9a-fA-F]{6}$' and coalesce(appearance_settings->>'background','') ~ '^#[0-9a-fA-F]{6}$')
);
create index review_cards_business_idx on public.review_cards(business_id);
create table public.review_card_links (
 id uuid primary key default gen_random_uuid(), review_card_id uuid not null references public.review_cards(id) on delete cascade,
 business_review_link_id uuid not null references public.business_review_links(id) on delete cascade,
 display_order integer not null default 0 check(display_order>=0), is_enabled boolean not null default true,
 unique(review_card_id,business_review_link_id)
);
create index review_card_links_destination_idx on public.review_card_links(business_review_link_id);
create table public.review_card_events (
 id uuid primary key default gen_random_uuid(), review_card_id uuid not null references public.review_cards(id) on delete cascade,
 event_type text not null check(event_type in ('page_view','outbound_click')), business_review_link_id uuid references public.business_review_links(id) on delete set null,
 referrer text check(referrer is null or (length(referrer)<=253 and referrer ~ '^([a-z0-9-]+\.)+[a-z]{2,63}$')),
 created_at timestamptz not null default now(),
 check((event_type='page_view' and business_review_link_id is null) or event_type='outbound_click')
);
create index review_card_events_card_date_idx on public.review_card_events(review_card_id,created_at);
create index review_card_events_link_idx on public.review_card_events(business_review_link_id);
create table public.business_activity (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 action text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index business_activity_business_date_idx on public.business_activity(business_id,created_at desc);

-- Security-definer helpers avoid recursive membership policies.
create function public.can_read_business(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.businesses b where b.id=p_id and b.owner_id=auth.uid()) or exists(select 1 from public.business_members m where m.business_id=p_id and m.user_id=auth.uid())
$$;
create function public.can_write_business(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.businesses b where b.id=p_id and b.owner_id=auth.uid()) or exists(select 1 from public.business_members m where m.business_id=p_id and m.user_id=auth.uid() and m.role in ('admin','editor'))
$$;
create function public.owns_business(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.businesses b where b.id=p_id and b.owner_id=auth.uid())
$$;
revoke all on function public.can_read_business(uuid), public.can_write_business(uuid), public.owns_business(uuid) from public,anon;
grant execute on function public.can_read_business(uuid), public.can_write_business(uuid), public.owns_business(uuid) to authenticated,service_role;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.review_platforms enable row level security;
alter table public.business_review_links enable row level security;
alter table public.review_cards enable row level security;
alter table public.review_card_links enable row level security;
alter table public.review_card_events enable row level security;
alter table public.business_activity enable row level security;
create policy businesses_read on public.businesses for select to authenticated using(public.can_read_business(id));
create policy members_read on public.business_members for select to authenticated using(public.can_read_business(business_id));
create policy platforms_read on public.review_platforms for select to authenticated using(true);
create policy links_read on public.business_review_links for select to authenticated using(public.can_read_business(business_id));
create policy cards_read on public.review_cards for select to authenticated using(public.can_read_business(business_id));
create policy card_links_read on public.review_card_links for select to authenticated using(exists(select 1 from public.review_cards c where c.id=review_card_id and public.can_read_business(c.business_id)));
create policy events_read on public.review_card_events for select to authenticated using(exists(select 1 from public.review_cards c where c.id=review_card_id and public.can_read_business(c.business_id)));
create policy activity_read on public.business_activity for select to authenticated using(public.can_read_business(business_id));
-- No anonymous reads, no browser-direct writes: sensitive changes go through authorized RPCs.
revoke all on public.businesses,public.business_members,public.review_platforms,public.business_review_links,public.review_cards,public.review_card_links,public.review_card_events,public.business_activity from anon,authenticated;
grant select on public.businesses,public.business_members,public.review_platforms,public.business_review_links,public.review_cards,public.review_card_links,public.review_card_events,public.business_activity to authenticated;
grant all on public.businesses,public.business_members,public.review_platforms,public.business_review_links,public.review_cards,public.review_card_links,public.review_card_events,public.business_activity to service_role;

create function public.check_logo_url(p_url text) returns boolean language sql immutable set search_path=public as $$
 select p_url='' or (p_url ~ '^https://[^/?#@[:space:]\\]+/storage/v1/object/public/business-assets/[0-9a-f-]+/' and length(p_url)<=2048)
$$;
create function public.save_business(p_business jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=(p_business->>'id')::uuid; v_owner uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
 select owner_id into v_owner from public.businesses where id=v_id for update;
 if found and not public.can_write_business(v_id) then raise exception 'Business access denied'; end if;
 if not public.check_logo_url(coalesce(p_business->>'logo_url','')) then raise exception 'Invalid business logo URL'; end if;
 if coalesce(p_business->>'website_url','')<>'' and not public.valid_review_url('custom',p_business->>'website_url') then raise exception 'Invalid HTTPS website URL'; end if;
 if length(coalesce(p_business->>'description',''))>1000 then raise exception 'Business description is too long'; end if;
 insert into public.businesses(id,owner_id,name,slug,description,logo_url,website_url,category,contact_email,brand_color)
 values(v_id,coalesce(v_owner,auth.uid()),trim(p_business->>'name'),p_business->>'slug',coalesce(p_business->>'description',''),coalesce(p_business->>'logo_url',''),coalesce(p_business->>'website_url',''),coalesce(p_business->>'category',''),coalesce(p_business->>'contact_email',''),coalesce(p_business->>'brand_color','#4b7fe7'))
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,logo_url=excluded.logo_url,website_url=excluded.website_url,category=excluded.category,contact_email=excluded.contact_email,brand_color=excluded.brand_color,updated_at=now();
 insert into public.business_activity(business_id,action,metadata) values(v_id,'Business profile updated',jsonb_build_object('name',p_business->>'name'));
 return v_id;
end $$;

create function public.deactivate_empty_cards(p_business uuid) returns void language sql security definer set search_path=public as $$
 update public.review_cards c set is_active=false,updated_at=now() where c.business_id=p_business and c.is_active and not exists(select 1 from public.review_card_links cl join public.business_review_links l on l.id=cl.business_review_link_id where cl.review_card_id=c.id and cl.is_enabled and l.is_active)
$$;
revoke all on function public.deactivate_empty_cards(uuid) from public,anon,authenticated;

create function public.save_review_link(p_link jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=(p_link->>'id')::uuid; v_business uuid:=(p_link->>'business_id')::uuid; existing public.business_review_links;
begin
 if not public.can_write_business(v_business) then raise exception 'Business access denied'; end if;
 perform 1 from public.businesses where id=v_business for update;
 select * into existing from public.business_review_links where id=v_id;
 if found and existing.business_id<>v_business then raise exception 'Destination access denied'; end if;
 if existing.id is not null and existing.platform_id<>p_link->>'platform_id' then raise exception 'Platform type cannot be changed'; end if;
 if not public.valid_review_url(p_link->>'platform_id',p_link->>'destination_url') then raise exception 'Invalid HTTPS destination or platform domain'; end if;
 insert into public.business_review_links(id,business_id,platform_id,display_name,destination_url,is_active)
 values(v_id,v_business,p_link->>'platform_id',trim(p_link->>'display_name'),p_link->>'destination_url',(p_link->>'is_active')::boolean)
 on conflict(id) do update set display_name=excluded.display_name,destination_url=excluded.destination_url,is_active=excluded.is_active,updated_at=now();
 perform public.deactivate_empty_cards(v_business);
 insert into public.business_activity(business_id,action,metadata) values(v_business,case when existing.id is null then 'Review platform added' else 'Review platform updated' end,jsonb_build_object('name',p_link->>'display_name'));
 return v_id;
end $$;
create function public.delete_review_link(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare destination public.business_review_links;
begin
 select * into destination from public.business_review_links where id=p_id;
 if not found or not public.can_write_business(destination.business_id) then raise exception 'Destination access denied'; end if;
 perform 1 from public.businesses where id=destination.business_id for update;
 delete from public.business_review_links where id=p_id;
 perform public.deactivate_empty_cards(destination.business_id);
 insert into public.business_activity(business_id,action,metadata) values(destination.business_id,'Review platform removed',jsonb_build_object('name',destination.display_name));
end $$;

-- Card and link changes commit atomically; cross-business links are rejected.
create function public.save_review_card(p_card jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=(p_card->>'id')::uuid; v_business uuid:=(p_card->>'business_id')::uuid; existing public.review_cards; v_item jsonb; appearance jsonb:=p_card->'appearance_settings';
begin
 if not public.can_write_business(v_business) then raise exception 'Business access denied'; end if;
 perform 1 from public.businesses where id=v_business for update;
 select * into existing from public.review_cards where id=v_id;
 if found and existing.business_id<>v_business then raise exception 'Card access denied'; end if;
 if appearance is null or not (coalesce(appearance->>'accent','') ~ '^#[0-9a-fA-F]{6}$') or not (coalesce(appearance->>'background','') ~ '^#[0-9a-fA-F]{6}$') or coalesce(appearance->>'button_style','') not in ('filled','outline','soft') or coalesce(appearance->>'radius','') not in ('square','rounded','pill') then raise exception 'Invalid appearance settings'; end if;
 if not public.check_logo_url(coalesce(appearance->>'logo_url','')) then raise exception 'Invalid card logo URL'; end if;
 if jsonb_typeof(p_card->'links') is distinct from 'array' then raise exception 'Card destinations are required'; end if;
 for v_item in select value from jsonb_array_elements(p_card->'links') loop
  if not exists(select 1 from public.business_review_links where id=(v_item->>'business_review_link_id')::uuid and business_id=v_business) then raise exception 'A destination belongs to another business or no longer exists'; end if;
 end loop;
 if (p_card->>'is_active')::boolean and not exists(select 1 from jsonb_array_elements(p_card->'links') item join public.business_review_links l on l.id=(item->>'business_review_link_id')::uuid where (item->>'is_enabled')::boolean and l.is_active) then raise exception 'An active card needs an enabled destination'; end if;
 insert into public.review_cards(id,business_id,name,slug,headline,description,appearance_settings,is_active)
 values(v_id,v_business,trim(p_card->>'name'),p_card->>'slug',trim(p_card->>'headline'),coalesce(p_card->>'description',''),appearance,(p_card->>'is_active')::boolean)
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,headline=excluded.headline,description=excluded.description,appearance_settings=excluded.appearance_settings,is_active=excluded.is_active,updated_at=now();
 delete from public.review_card_links where review_card_id=v_id;
 insert into public.review_card_links(review_card_id,business_review_link_id,display_order,is_enabled)
 select v_id,(item->>'business_review_link_id')::uuid,(item->>'display_order')::integer,(item->>'is_enabled')::boolean from jsonb_array_elements(p_card->'links') item;
 insert into public.business_activity(business_id,action,metadata) values(v_business,case when existing.id is null then 'Review card created' else 'Review card updated' end,jsonb_build_object('name',p_card->>'name'));
 return v_id;
end $$;
create function public.delete_review_card(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare card public.review_cards;
begin
 select * into card from public.review_cards where id=p_id;
 if not found or not public.can_write_business(card.business_id) then raise exception 'Card access denied'; end if;
 perform 1 from public.businesses where id=card.business_id for update;
 delete from public.review_cards where id=p_id;
 insert into public.business_activity(business_id,action,metadata) values(card.business_id,'Review card deleted',jsonb_build_object('name',card.name));
end $$;

create function public.workspace_events(p_business_id uuid) returns table(id text,review_card_id uuid,event_type text,business_review_link_id uuid,referrer text,created_at timestamptz,count bigint) language sql stable security definer set search_path=public as $$
 select md5(c.id::text||e.event_type||coalesce(e.business_review_link_id::text,'')||coalesce(e.referrer,'')||(date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila')::text),c.id,e.event_type,e.business_review_link_id,e.referrer,(date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila'),count(*)
 from public.review_card_events e join public.review_cards c on c.id=e.review_card_id where c.business_id=p_business_id and public.can_read_business(p_business_id)
 group by c.id,e.event_type,e.business_review_link_id,e.referrer,(date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila') order by (date_trunc('day',e.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila'),c.id,e.event_type,e.business_review_link_id,e.referrer
$$;

-- Future tracking ingress: service-role only, no anonymous endpoint or policy.
-- Idempotent IDs + per-card rate cap + active-link checks; no IPs/visitor IDs.
create function public.ingest_review_event(p_id uuid,p_card_id uuid,p_type text,p_link_id uuid default null,p_referrer text default null) returns void language plpgsql security definer set search_path=public as $$
declare v_business uuid;
begin
 select business_id into v_business from public.review_cards where id=p_card_id and is_active for update;
 if not found then raise exception 'Card unavailable'; end if;
 if exists(select 1 from public.review_card_events where id=p_id) then return; end if;
 if p_type not in ('page_view','outbound_click') then raise exception 'Invalid event type'; end if;
 if p_type='page_view' and p_link_id is not null then raise exception 'Page views cannot target destinations'; end if;
 if p_type='outbound_click' and not exists(select 1 from public.review_card_links cl join public.business_review_links l on l.id=cl.business_review_link_id where cl.review_card_id=p_card_id and cl.business_review_link_id=p_link_id and cl.is_enabled and l.is_active and l.business_id=v_business) then raise exception 'Destination unavailable'; end if;
 if (select count(*) from public.review_card_events where review_card_id=p_card_id and created_at>now()-interval '1 minute')>=120 then raise exception 'Event rate limit exceeded'; end if;
 insert into public.review_card_events(id,review_card_id,event_type,business_review_link_id,referrer) values(p_id,p_card_id,p_type,p_link_id,nullif(lower(p_referrer),''));
 insert into public.business_activity(business_id,action,metadata) select v_business,'Review link clicked',jsonb_build_object('name',display_name) from public.business_review_links where id=p_link_id and p_type='outbound_click';
end $$;
revoke all on function public.ingest_review_event(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.ingest_review_event(uuid,uuid,text,uuid,text) to service_role;
revoke all on function public.save_business(jsonb), public.save_review_link(jsonb),public.delete_review_link(uuid),public.save_review_card(jsonb),public.delete_review_card(uuid),public.workspace_events(uuid) from public,anon;
grant execute on function public.save_business(jsonb), public.save_review_link(jsonb),public.delete_review_link(uuid),public.save_review_card(jsonb),public.delete_review_card(uuid),public.workspace_events(uuid) to authenticated;

-- Public bucket contains intentional brand assets only, never business records.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('business-assets','business-assets',true,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy business_asset_read on storage.objects for select to anon,authenticated using(bucket_id='business-assets');
create policy business_asset_upload on storage.objects for insert to authenticated with check(bucket_id='business-assets' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.can_write_business(((storage.foldername(name))[1])::uuid));
create policy business_asset_delete on storage.objects for delete to authenticated using(bucket_id='business-assets' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.can_write_business(((storage.foldername(name))[1])::uuid));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-assets','profile-assets',true,256000,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy profile_asset_read on storage.objects for select to anon,authenticated using(bucket_id='profile-assets');
create policy profile_asset_upload on storage.objects for insert to authenticated with check(bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text);
create policy profile_asset_delete on storage.objects for delete to authenticated using(bucket_id='profile-assets' and (storage.foldername(name))[1]=auth.uid()::text);
