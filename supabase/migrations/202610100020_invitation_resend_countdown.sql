-- One-minute invitation resend cooldown, with server timestamps for the UI.
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
  -- Completion means successful membership acceptance, not merely saving a password.
  if not exists(select 1 from public.workspace_invitations where invited_by=p_actor and invited_user_id=recipient and lower(email)=lower(trim(p_email)))
   or exists(select 1 from public.business_members where user_id=recipient)
   or exists(select 1 from public.businesses where owner_id=recipient)
   or exists(select 1 from public.workspace_invitations where invited_user_id=recipient and status='accepted') then
   raise exception 'This email already has an account. Invite a new email address.';
  end if;
  if exists(select 1 from public.workspace_invitations where invited_user_id=recipient and invited_by=p_actor and created_at>now()-interval '1 minute') then
   raise exception 'Please wait one minute before resending this invitation';
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
 'invitations',case when b.owner_id=auth.uid() then coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expires_at',expires_at,'resend_available_at',created_at+interval '1 minute','all_businesses',all_businesses) order by created_at) from public.workspace_invitations where business_ids @> array[p_business] and invited_by=b.owner_id and status='pending' and expires_at>now()),'[]'::jsonb) else '[]'::jsonb end);
end $$;
revoke all on function public.workspace_members(uuid) from public,anon;
grant execute on function public.workspace_members(uuid) to authenticated;

