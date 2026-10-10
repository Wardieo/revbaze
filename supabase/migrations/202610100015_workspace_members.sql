-- Membership is scoped to a business; invitation and role changes are owner-only.
create table public.workspace_invitations (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 email text not null check(length(email) between 3 and 254), role text not null check(role in ('admin','editor','viewer')),
 invited_by uuid not null references auth.users(id), invited_user_id uuid references auth.users(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','accepted','revoked','failed')),
 expires_at timestamptz not null default now()+interval '7 days', created_at timestamptz not null default now()
);
create unique index workspace_invitation_pending_email on public.workspace_invitations(lower(email)) where status='pending';
alter table public.workspace_invitations enable row level security;
revoke all on public.workspace_invitations from public,anon,authenticated;
grant all on public.workspace_invitations to service_role;

create function public.workspace_member_limit(p_owner uuid) returns integer language sql stable security definer set search_path=public as $$
 select case public.effective_account_plan(p_owner) when 'growth' then 5 when 'pro' then 20 else 0 end
$$;
revoke all on function public.workspace_member_limit(uuid) from public,anon;
grant execute on function public.workspace_member_limit(uuid) to authenticated,service_role;

create or replace function public.can_read_business(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.businesses b where b.id=p_id and b.owner_id=auth.uid()) or exists(
 select 1 from (select m.user_id,row_number() over(order by m.created_at,m.user_id) as seat,b.owner_id
 from public.business_members m join public.businesses b on b.id=m.business_id where m.business_id=p_id and m.user_id<>b.owner_id) ranked
 where ranked.user_id=auth.uid() and ranked.seat<=public.workspace_member_limit(ranked.owner_id))
$$;
create or replace function public.can_write_business(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.owns_business(p_id) or (public.can_read_business(p_id) and exists(select 1 from public.business_members where business_id=p_id and user_id=auth.uid() and role in ('admin','editor')))
$$;

create function public.workspace_members(p_business uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare b public.businesses; v_role text;
begin
 if not public.can_read_business(p_business) then raise exception 'Business access denied'; end if;
 select * into b from public.businesses where id=p_business;
 select case when b.owner_id=auth.uid() then 'owner' else (select role from public.business_members where business_id=p_business and user_id=auth.uid()) end into v_role;
 return jsonb_build_object('role',v_role,'limit',public.workspace_member_limit(b.owner_id),
 'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',u.id,'email',u.email,'role',case when u.id=b.owner_id then 'owner' else m.role end,'active',u.id=b.owner_id or ranked.seat<=public.workspace_member_limit(b.owner_id)) order by u.id=b.owner_id desc,m.created_at)
 from auth.users u left join public.business_members m on m.user_id=u.id and m.business_id=p_business
 left join (select user_id,row_number() over(order by created_at,user_id) seat from public.business_members where business_id=p_business and user_id<>b.owner_id) ranked on ranked.user_id=u.id
 where u.id=b.owner_id or m.user_id is not null),'[]'::jsonb),
 'invitations',case when b.owner_id=auth.uid() then coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expires_at',expires_at) order by created_at) from public.workspace_invitations where business_id=p_business and status='pending' and expires_at>now()),'[]'::jsonb) else '[]'::jsonb end);
end $$;
revoke all on function public.workspace_members(uuid) from public,anon;
grant execute on function public.workspace_members(uuid) to authenticated;

-- Only the authenticated Edge handler may supply p_actor. Not callable by browsers.
create function public.reserve_workspace_invitation(p_actor uuid,p_business uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path=public as $$
declare b public.businesses; v_id uuid; used integer; cap integer;
begin
 select * into b from public.businesses where id=p_business;
 if b.owner_id is distinct from p_actor then raise exception 'Only the workspace owner can invite members'; end if;
 if p_role not in ('admin','editor','viewer') then raise exception 'Invalid member role'; end if;
 if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
 perform pg_advisory_xact_lock(hashtextextended(b.owner_id::text,4));
 perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_email)),15));
 update public.workspace_invitations set status='revoked' where status='pending' and expires_at<=now();
 if exists(select 1 from auth.users where lower(email)=lower(trim(p_email))) then raise exception 'This email already has an account. Invite a new email address.'; end if;
 if exists(select 1 from public.workspace_invitations where lower(email)=lower(trim(p_email)) and status='pending') then raise exception 'An invitation is already pending for this email'; end if;
 if (select count(*) from public.workspace_invitations where invited_by=p_actor and created_at>now()-interval '1 hour')>=10 then raise exception 'Invitation rate limit reached. Please try again in an hour.'; end if;
 cap:=public.workspace_member_limit(b.owner_id);
 select (select count(*) from public.business_members where business_id=p_business and user_id<>b.owner_id)+(select count(*) from public.workspace_invitations where business_id=p_business and status='pending' and expires_at>now()) into used;
 if used>=cap then raise exception 'Member limit reached. Growth allows 5 and Pro allows 20 invited members per business.'; end if;
 insert into public.workspace_invitations(business_id,email,role,invited_by) values(p_business,lower(trim(p_email)),p_role,p_actor) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.reserve_workspace_invitation(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_workspace_invitation(uuid,uuid,text,text) to service_role;

create function public.accept_workspace_invitation(p_invitation uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare i public.workspace_invitations; b public.businesses; used integer;
begin
 if auth.uid() is null then raise exception 'Sign in using your invitation email'; end if;
 select * into i from public.workspace_invitations where id=p_invitation;
 select * into b from public.businesses where id=i.business_id;
 perform pg_advisory_xact_lock(hashtextextended(b.owner_id::text,4));
 select * into i from public.workspace_invitations where id=p_invitation for update;
 if i.invited_user_id is distinct from auth.uid() or not exists(select 1 from auth.users where id=auth.uid() and lower(email)=i.email and email_confirmed_at is not null) then raise exception 'This invitation does not belong to your verified account'; end if;
 if i.status='accepted' then
  if not exists(select 1 from public.business_members where business_id=i.business_id and user_id=auth.uid()) then raise exception 'Your workspace membership has been removed'; end if;
  if not public.can_read_business(i.business_id) then raise exception 'Workspace access is paused by the current plan'; end if;
  return i.business_id;
 end if;
 if i.status<>'pending' or i.expires_at<=now() then raise exception 'This invitation has expired or was revoked'; end if;
 select count(*) into used from public.business_members where business_id=i.business_id and user_id<>b.owner_id;
 if used>=public.workspace_member_limit(b.owner_id) then raise exception 'The workspace plan does not have an available member seat'; end if;
 insert into public.business_members(business_id,user_id,role) values(i.business_id,auth.uid(),i.role);
 update public.workspace_invitations set status='accepted' where id=i.id;
 return i.business_id;
end $$;
revoke all on function public.accept_workspace_invitation(uuid) from public,anon;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;

create function public.manage_workspace_member(p_business uuid,p_user uuid default null,p_role text default null,p_invitation uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare b public.businesses;
begin
 select * into b from public.businesses where id=p_business;
 if not public.owns_business(p_business) then raise exception 'Only the owner can manage members'; end if;
 perform pg_advisory_xact_lock(hashtextextended(b.owner_id::text,4));
 if p_invitation is not null then
 update public.workspace_invitations set status='revoked' where id=p_invitation and business_id=p_business and status='pending'; return;
 end if;
 if p_user=b.owner_id then raise exception 'The owner role cannot be changed or removed'; end if;
 if p_role is null then delete from public.business_members where business_id=p_business and user_id=p_user;
 elsif p_role in ('admin','editor','viewer') then update public.business_members set role=p_role where business_id=p_business and user_id=p_user;
 else raise exception 'Invalid member role'; end if;
end $$;
revoke all on function public.manage_workspace_member(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.manage_workspace_member(uuid,uuid,text,uuid) to authenticated;

-- Editors can manage cards/platforms but cannot alter the business profile.
create function public.enforce_business_profile_role() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and not public.owns_business(old.id) and not(public.can_read_business(old.id) and exists(select 1 from public.business_members where business_id=old.id and user_id=auth.uid() and role='admin')) then raise exception 'Only owners and admins can edit business settings'; end if;
 return new;
end $$;
revoke all on function public.enforce_business_profile_role() from public,anon,authenticated;
create trigger business_profile_role before update on public.businesses for each row execute function public.enforce_business_profile_role();

-- Business assets follow business-profile permissions, rather than card editing.
create function public.can_manage_business_profile(p_business uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.owns_business(p_business) or (public.can_read_business(p_business) and exists(select 1 from public.business_members where business_id=p_business and user_id=auth.uid() and role='admin'))
$$;
revoke all on function public.can_manage_business_profile(uuid) from public,anon;
grant execute on function public.can_manage_business_profile(uuid) to authenticated,service_role;
alter policy business_asset_upload on storage.objects with check(bucket_id='business-assets' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.can_manage_business_profile(((storage.foldername(name))[1])::uuid));
alter policy business_asset_delete on storage.objects using(bucket_id='business-assets' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.can_manage_business_profile(((storage.foldername(name))[1])::uuid));
