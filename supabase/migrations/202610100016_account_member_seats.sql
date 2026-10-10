-- Seats belong to the owner account; access remains scoped to an invited business.
create function public.account_member_seats(p_owner uuid) returns table(user_id uuid,seat bigint)
language sql stable security definer set search_path=public as $$
 select grouped.user_id,row_number() over(order by grouped.first_joined,grouped.user_id)
 from (select m.user_id,min(m.created_at) first_joined from public.business_members m
 join public.businesses b on b.id=m.business_id where b.owner_id=p_owner and m.user_id<>p_owner group by m.user_id) grouped
$$;
revoke all on function public.account_member_seats(uuid) from public,anon,authenticated;
grant execute on function public.account_member_seats(uuid) to service_role;
create function public.account_member_usage(p_owner uuid) returns integer
language sql stable security definer set search_path=public as $$
 select ((select count(*) from public.account_member_seats(p_owner))+
 (select count(distinct lower(i.email)) from public.workspace_invitations i join public.businesses b on b.id=i.business_id
 where b.owner_id=p_owner and i.status='pending' and i.expires_at>now()))::integer
$$;
revoke all on function public.account_member_usage(uuid) from public,anon,authenticated;
grant execute on function public.account_member_usage(uuid) to service_role;
create or replace function public.can_read_business(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.businesses b where b.id=p_id and (b.owner_id=auth.uid() or exists(
 select 1 from public.business_members m join public.account_member_seats(b.owner_id) s on s.user_id=m.user_id
 where m.business_id=b.id and m.user_id=auth.uid() and s.seat<=public.workspace_member_limit(b.owner_id))))
$$;
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
 'invitations',case when b.owner_id=auth.uid() then coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expires_at',expires_at) order by created_at) from public.workspace_invitations where business_id=p_business and status='pending' and expires_at>now()),'[]'::jsonb) else '[]'::jsonb end);
end $$;
revoke all on function public.workspace_members(uuid) from public,anon;
grant execute on function public.workspace_members(uuid) to authenticated;

-- Only the authenticated Edge handler may supply p_actor. Not callable by browsers.
create or replace function public.reserve_workspace_invitation(p_actor uuid,p_business uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path=public as $$
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
 select public.account_member_usage(b.owner_id) into used;
 if used>=cap then raise exception 'Member limit reached. Growth allows 5 and Pro allows 20 invited members across all your businesses.'; end if;
 insert into public.workspace_invitations(business_id,email,role,invited_by) values(p_business,lower(trim(p_email)),p_role,p_actor) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.reserve_workspace_invitation(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_workspace_invitation(uuid,uuid,text,text) to service_role;

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
 insert into public.business_members(business_id,user_id,role) values(i.business_id,auth.uid(),i.role);
 update public.workspace_invitations set status='accepted' where id=i.id;
 return i.business_id;
end $$;
revoke all on function public.accept_workspace_invitation(uuid) from public,anon;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;

