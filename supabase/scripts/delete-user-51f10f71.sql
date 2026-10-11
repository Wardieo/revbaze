-- Manual script for the Supabase SQL Editor, executed as postgres.
-- Permanently deletes this account and its owned business database records.
-- Before running, remove its uploaded files through the Storage API/dashboard
-- and cancel any Stripe subscription separately. SQL cannot do either action.
-- Do not delete storage.objects directly: that leaves uploaded files behind.
begin;

do $$
declare
 target_user constant uuid := '51f10f71-cb2e-485f-8901-9593a337463f';
 target_email text;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_user::text,4));
 select email into target_email from auth.users where id=target_user for update;
 if not found then
  raise exception 'Target account does not exist; no records deleted';
 end if;

 if lower(coalesce(target_email,'')) <> 'edwardmosquera12345@gmail.com' then
  raise exception 'UID/email mismatch; no records deleted';
 end if;

 -- invited_by is a restrictive FK; delete these before deleting the account.
 -- Also remove invitations received by this account, instead of leaving a null recipient.
 delete from public.workspace_invitations
 where invited_by=target_user or invited_user_id=target_user
 or (target_email is not null and lower(email)=lower(target_email));

 -- Contact submissions use an email address rather than a user foreign key.
 delete from public.contact_messages
 where target_email is not null and lower(email)=lower(target_email);

 -- Cascades delete owned businesses, their cards/platform links/events/activity,
 -- memberships, onboarding drafts, plan selection, account plan and billing records.
 -- Other people's Auth accounts are preserved.
 delete from auth.users where id=target_user;
end $$;

commit;
