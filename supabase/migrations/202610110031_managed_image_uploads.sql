-- All new uploads go through image-upload; browser Storage INSERT is closed.
drop policy business_asset_upload on storage.objects;
drop policy profile_asset_upload on storage.objects;
update storage.buckets set file_size_limit=524288,allowed_mime_types=array['image/png','image/jpeg'] where id in ('business-assets','profile-assets');
create table public.managed_assets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, bucket text not null, name text not null,
 bytes bigint not null check(bytes>0), status text not null check(status in ('reserved','ready','retiring','deleted')),
 created_at timestamptz not null default now(), unique(bucket,name)
);
create index managed_assets_owner_idx on public.managed_assets(owner_id,status);
create index managed_assets_actor_date_idx on public.managed_assets(actor_id,created_at);
create index managed_assets_cleanup_idx on public.managed_assets(created_at) where status<>'deleted';
alter table public.managed_assets enable row level security;
revoke all on public.managed_assets from public,anon,authenticated;
grant all on public.managed_assets to service_role;
-- Include existing files in quota accounting. Unknown size counts conservatively.
insert into public.managed_assets(owner_id,bucket,name,bytes,status)
 select b.owner_id,o.bucket_id,o.name,greatest(coalesce(nullif(o.metadata->>'size','')::bigint,10485760),1),'ready'
 from storage.objects o join public.businesses b on split_part(o.name,'/',1)=b.id::text where o.bucket_id='business-assets'
 union all
 select u.id,o.bucket_id,o.name,greatest(coalesce(nullif(o.metadata->>'size','')::bigint,10485760),1),'ready'
 from storage.objects o join auth.users u on split_part(o.name,'/',1)=u.id::text where o.bucket_id='profile-assets';
create function public.reserve_image_upload(p_actor uuid,p_business uuid,p_bucket text,p_id uuid,p_bytes bigint,p_extension text) returns text
language plpgsql security definer set search_path=public as $$
declare owner uuid; folder text; quota bigint; tier text; path text;
begin
 if p_bytes<1 or p_bytes>524288 or p_extension not in ('png','jpeg') then raise exception 'Invalid image upload'; end if;
 if p_bucket='profile-assets' then
  if not exists(select 1 from auth.users where id=p_actor) then raise exception 'Authentication required'; end if;
  owner:=p_actor; folder:=p_actor::text;
 elsif p_bucket='business-assets' then
  select owner_id into owner from public.businesses where id=p_business;
  -- Verified actor is passed only by the service-role Edge handler. Mirror the RLS permission using its JWT claim.
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  if owner is null or not public.can_write_business(p_business) or not public.plan_business_available(p_business) then raise exception 'Business access denied'; end if;
  folder:=p_business::text;
 else raise exception 'Invalid upload bucket'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,32));
 perform pg_advisory_xact_lock(hashtextextended(owner::text,31));
 if (select count(*) from public.managed_assets where actor_id=p_actor and created_at>now()-interval '10 minutes')>=10 then raise exception 'Upload rate limit exceeded. Try again in ten minutes'; end if;
 tier:=public.effective_account_plan(owner);
 quota:=case tier when 'free' then 20971520 when 'growth' then 104857600 else 524288000 end;
 if coalesce((select sum(bytes) from public.managed_assets where owner_id=owner and status<>'deleted'),0)+p_bytes>quota then raise exception 'Image storage allowance reached. Remove unused images or contact support'; end if;
 path:=folder||'/'||p_id::text||'.'||p_extension;
 insert into public.managed_assets(id,owner_id,actor_id,bucket,name,bytes,status) values(p_id,owner,p_actor,p_bucket,path,p_bytes,'reserved');
 return path;
end $$;
create function public.complete_image_upload(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 update public.managed_assets a set status='ready' where id=p_id and status='reserved' and exists(select 1 from storage.objects o where o.bucket_id=a.bucket and o.name=a.name);
 if not found then raise exception 'Image upload was not completed'; end if;
end $$;
create function public.asset_is_referenced(p_bucket text,p_name text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.businesses where strpos(logo_url,'/storage/v1/object/public/'||p_bucket||'/'||p_name)>0)
 or exists(select 1 from public.review_cards where strpos(appearance_settings::text,'/storage/v1/object/public/'||p_bucket||'/'||p_name)>0)
 or exists(select 1 from public.onboarding_drafts where completed_at is null and strpos(draft::text,'/storage/v1/object/public/'||p_bucket||'/'||p_name)>0)
 or exists(select 1 from auth.users where strpos(raw_user_meta_data::text,'/storage/v1/object/public/'||p_bucket||'/'||p_name)>0)
$$;
-- Reference writes and retirement lock the same asset rows. New references cannot race deletion.
create function public.guard_asset_reference() returns trigger language plpgsql security definer set search_path=public as $$
declare asset record; document text:=to_jsonb(new)::text;
begin
 if document ~ '/storage/v1/object/public/(business-assets|profile-assets)/[^" ]*%' then raise exception 'Use the original image URL without encoded path characters'; end if;
 for asset in select a.* from public.managed_assets a join (
  select distinct match[1] as bucket,match[2] as name from regexp_matches(document,'/storage/v1/object/public/(business-assets|profile-assets)/([^" ?#]+)', 'g') match
 ) refs on refs.bucket=a.bucket and refs.name=a.name order by a.id for update of a loop
  if asset.status<>'ready' then raise exception 'This image is unavailable. Upload it again'; end if;
 end loop;
 return new;
end $$;
create trigger business_asset_reference before insert or update of logo_url on public.businesses for each row execute function public.guard_asset_reference();
create trigger card_asset_reference before insert or update of appearance_settings on public.review_cards for each row execute function public.guard_asset_reference();
create trigger draft_asset_reference before insert or update of draft on public.onboarding_drafts for each row execute function public.guard_asset_reference();
create trigger profile_asset_reference before insert or update of raw_user_meta_data on auth.users for each row execute function public.guard_asset_reference();

create function public.claim_unused_assets(p_limit integer default 100) returns table(id uuid,bucket text,name text)
language plpgsql security definer set search_path=public as $$
declare asset public.managed_assets;
begin
 for asset in select * from public.managed_assets a where a.status<>'deleted' and a.created_at<now()-interval '24 hours' and (a.status='retiring' or not public.asset_is_referenced(a.bucket,a.name)) order by a.id limit least(greatest(p_limit,1),100) for update skip locked loop
  if asset.status='retiring' or not public.asset_is_referenced(asset.bucket,asset.name) then
   update public.managed_assets set status='retiring' where managed_assets.id=asset.id;
   id:=asset.id; bucket:=asset.bucket; name:=asset.name; return next;
  end if;
 end loop;
end $$;
create function public.finish_asset_cleanup(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 update public.managed_assets set status='deleted' where id=p_id and status='retiring';
end $$;
revoke all on function public.reserve_image_upload(uuid,uuid,text,uuid,bigint,text),public.complete_image_upload(uuid),public.asset_is_referenced(text,text),public.guard_asset_reference(),public.claim_unused_assets(integer),public.finish_asset_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.reserve_image_upload(uuid,uuid,text,uuid,bigint,text),public.complete_image_upload(uuid),public.claim_unused_assets(integer),public.finish_asset_cleanup(uuid) to service_role;
