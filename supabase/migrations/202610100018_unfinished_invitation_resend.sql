-- Recover unfinished invites without permitting invitations to established accounts.
create or replace function public.reserve_workspace_invitation(p_actor uuid,p_business uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path=public as $$
declare b public.businesses; v_id uuid; used integer; cap integer; recipient uuid;
begin
 select * into b from public.businesses where id=p_business;
 if b.owner_id is distinct from p_actor then raise exception 'Only the workspace owner can invite members'; end if;
 if p_role not in ('admin','editor','viewer') then raise exception 'Invalid member role'; end if;
 if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
 perform pg_advisory_xact_lock(hashtextextended(b.owner_id::text,4));
 perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_email)),15));
 update public.workspace_invitations set status='revoked' where status='pending' and expires_at<=now();
 select id into recipient from auth.users where lower(email)=lower(trim(p_email));
 if recipient is not null then
  -- Reuse only an unfinished account created by this owner's earlier invitation.
  -- Passwords and membership are checked from server data, never user metadata.
  if not exists(select 1 from auth.users u where u.id=recipient and coalesce(u.encrypted_password,'')='')
   or not exists(select 1 from public.workspace_invitations where invited_by=p_actor and invited_user_id=recipient and lower(email)=lower(trim(p_email)))
   or exists(select 1 from public.business_members where user_id=recipient)
   or exists(select 1 from public.businesses where owner_id=recipient)
   or exists(select 1 from public.workspace_invitations where invited_user_id=recipient and status='accepted') then
   raise exception 'This email already has an account. Invite a new email address.';
  end if;
  if exists(select 1 from public.workspace_invitations where invited_user_id=recipient and invited_by=p_actor and created_at>now()-interval '2 minutes') then
   raise exception 'Please wait two minutes before resending this invitation';
  end if;
  -- Replacing an invitation releases its reservation and invalidates the old link.
  update public.workspace_invitations set status='revoked' where invited_by=p_actor and invited_user_id=recipient and status='pending';
 end if;
 if exists(select 1 from public.workspace_invitations where lower(email)=lower(trim(p_email)) and status='pending') then raise exception 'An invitation is already pending for this email'; end if;
 if (select count(*) from public.workspace_invitations where invited_by=p_actor and created_at>now()-interval '1 hour')>=10 then raise exception 'Invitation rate limit reached. Please try again in an hour.'; end if;
 cap:=public.workspace_member_limit(b.owner_id);
 select public.account_member_usage(b.owner_id) into used;
 if used>=cap then raise exception 'Member limit reached. Growth allows 5 and Pro allows 20 invited members across all your businesses.'; end if;
 insert into public.workspace_invitations(business_id,email,role,invited_by,invited_user_id) values(p_business,lower(trim(p_email)),p_role,p_actor,recipient) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.reserve_workspace_invitation(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_workspace_invitation(uuid,uuid,text,text) to service_role;

create function public.validate_workspace_invitation(p_invitation uuid) returns uuid
language plpgsql stable security definer set search_path=public as $$
declare i public.workspace_invitations; owner uuid;
begin
 if auth.uid() is null then raise exception 'Open your secure invitation email'; end if;
 select * into i from public.workspace_invitations where id=p_invitation;
 if not found or i.invited_user_id is distinct from auth.uid() or not exists(select 1 from auth.users where id=auth.uid() and lower(email)=i.email and email_confirmed_at is not null) then
  raise exception 'This invitation does not belong to your verified account';
 end if;
 if i.status='accepted' then
  if not exists(select 1 from public.business_members where business_id=i.business_id and user_id=auth.uid()) then raise exception 'Your workspace membership has been removed'; end if;
  if not public.can_read_business(i.business_id) then raise exception 'Workspace access is paused by the current plan'; end if;
  return i.business_id;
 end if;
 if i.status<>'pending' or i.expires_at<=now() then raise exception 'This invitation has expired or was revoked. Ask the owner to resend it'; end if;
 select owner_id into owner from public.businesses where id=i.business_id;
 if owner is distinct from i.invited_by or exists(select 1 from unnest(i.business_ids) target(id) where not exists(select 1 from public.businesses b where b.id=target.id and b.owner_id=owner)) then
  raise exception 'An invited business is no longer available';
 end if;
 if (select count(*) from public.account_member_seats(owner) where user_id<>auth.uid())>=public.workspace_member_limit(owner) then
  raise exception 'The workspace plan does not have an available member seat';
 end if;
 return i.business_id;
end $$;
revoke all on function public.validate_workspace_invitation(uuid) from public,anon;
grant execute on function public.validate_workspace_invitation(uuid) to authenticated;
create or replace function public.accept_workspace_invitation(p_invitation uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare i public.workspace_invitations; b public.businesses; used integer;
begin
 perform public.validate_workspace_invitation(p_invitation);
 if not exists(select 1 from auth.users where id=auth.uid() and coalesce(encrypted_password,'')<>'') then raise exception 'Set your password before accepting your invitation'; end if;
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

