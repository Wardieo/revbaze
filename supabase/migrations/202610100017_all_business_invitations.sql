-- One invitation can include all businesses currently owned by the account.
alter table public.workspace_invitations add column business_ids uuid[];
alter table public.workspace_invitations add column all_businesses boolean not null default false;
update public.workspace_invitations set business_ids=array[business_id];
alter table public.workspace_invitations alter column business_ids set not null;
alter table public.workspace_invitations add constraint invitation_business_scope check(cardinality(business_ids)>0 and business_ids @> array[business_id]);
-- Preserve the four-argument reservation path for single-business invitations.
create function public.set_invitation_business_scope() returns trigger language plpgsql set search_path=public as $$
begin
 if new.business_ids is null then new.business_ids:=array[new.business_id]; end if;
 return new;
end $$;
revoke all on function public.set_invitation_business_scope() from public,anon,authenticated;
create trigger invitation_business_scope before insert on public.workspace_invitations for each row execute function public.set_invitation_business_scope();
create function public.reserve_scoped_workspace_invitation(p_actor uuid,p_business uuid,p_email text,p_role text,p_all_businesses boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare invitation uuid;
begin
 -- Existing reservation validates ownership, email, role, rate limits and shared quota.
 invitation:=public.reserve_workspace_invitation(p_actor,p_business,p_email,p_role);
 if p_all_businesses then
  update public.workspace_invitations set all_businesses=true,
  business_ids=(select array_agg(id order by id) from public.businesses where owner_id=p_actor)
  where id=invitation;
 end if;
 return invitation;
end $$;
revoke all on function public.reserve_scoped_workspace_invitation(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.reserve_scoped_workspace_invitation(uuid,uuid,text,text,boolean) to service_role;
create or replace function public.workspace_members(p_business uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare b public.businesses; v_role text;
begin
 if not public.can_read_business(p_business) then raise exception 'Business access denied'; end if;
 select * into b from public.businesses where id=p_business;
 select case when b.owner_id=auth.uid() then 'owner' else (select role from public.business_members where business_id=p_business and user_id=auth.uid()) end into v_role;
 return jsonb_build_object('role',v_role,'limit',public.workspace_member_limit(b.owner_id),
 'used',case when b.owner_id=auth.uid() then public.account_member_usage(b.owner_id) else null end,
 'businesses',case when b.owner_id=auth.uid() then (select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from public.businesses where owner_id=b.owner_id) else '[]'::jsonb end,
 'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',u.id,'email',u.email,'role',case when u.id=b.owner_id then 'owner' else m.role end,'active',u.id=b.owner_id or ranked.seat<=public.workspace_member_limit(b.owner_id)) order by u.id=b.owner_id desc,m.created_at)
 from auth.users u left join public.business_members m on m.user_id=u.id and m.business_id=p_business
 left join public.account_member_seats(b.owner_id) ranked on ranked.user_id=u.id
 where u.id=b.owner_id or m.user_id is not null),'[]'::jsonb),
 'invitations',case when b.owner_id=auth.uid() then coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expires_at',expires_at,'all_businesses',all_businesses) order by created_at) from public.workspace_invitations where business_ids @> array[p_business] and invited_by=b.owner_id and status='pending' and expires_at>now()),'[]'::jsonb) else '[]'::jsonb end);
end $$;
revoke all on function public.workspace_members(uuid) from public,anon;
grant execute on function public.workspace_members(uuid) to authenticated;

create or replace function public.accept_workspace_invitation(p_invitation uuid) returns uuid language plpgsql security definer set search_path=public as $$
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
 select count(*) into used from public.account_member_seats(b.owner_id) where user_id<>auth.uid();
 if used>=public.workspace_member_limit(b.owner_id) then raise exception 'The workspace plan does not have an available member seat'; end if;
 if exists(select 1 from unnest(i.business_ids) target(id) where not exists(select 1 from public.businesses owned where owned.id=target.id and owned.owner_id=i.invited_by)) then
  raise exception 'An invited business is no longer available. Ask the owner for a new invitation';
 end if;
 insert into public.business_members(business_id,user_id,role)
 select target,auth.uid(),i.role from unnest(i.business_ids) target;
 update public.workspace_invitations set status='accepted' where id=i.id;
 return i.business_id;
end $$;
revoke all on function public.accept_workspace_invitation(uuid) from public,anon;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;

create or replace function public.manage_workspace_member(p_business uuid,p_user uuid default null,p_role text default null,p_invitation uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare b public.businesses;
begin
 select * into b from public.businesses where id=p_business;
 if not public.owns_business(p_business) then raise exception 'Only the owner can manage members'; end if;
 perform pg_advisory_xact_lock(hashtextextended(b.owner_id::text,4));
 if p_invitation is not null then
 update public.workspace_invitations set status='revoked' where id=p_invitation and business_ids @> array[p_business] and invited_by=b.owner_id and status='pending'; return;
 end if;
 if p_user=b.owner_id then raise exception 'The owner role cannot be changed or removed'; end if;
 if p_role is null then delete from public.business_members where business_id=p_business and user_id=p_user;
 elsif p_role in ('admin','editor','viewer') then update public.business_members set role=p_role where business_id=p_business and user_id=p_user;
 else raise exception 'Invalid member role'; end if;
end $$;
revoke all on function public.manage_workspace_member(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.manage_workspace_member(uuid,uuid,text,uuid) to authenticated;

