-- Preserve PayMongo state for reconciliation without revoking paid account access.
create table public.legacy_paymongo_billing as
 select user_id, to_jsonb(billing_customers) as billing_state, now() as archived_at
 from public.billing_customers where paymongo_customer_id is not null;
alter table public.legacy_paymongo_billing enable row level security;
revoke all on public.legacy_paymongo_billing from public, anon, authenticated;
grant all on public.legacy_paymongo_billing to service_role;
alter table public.billing_customers rename column legacy_customer_id to stripe_customer_id;
update public.billing_customers set subscription_id=null,status=null,
 period_end=null,cancel_at_period_end=false where paymongo_customer_id is not null;
update public.billing_customers set checkout_session_id=null,checkout_plan=null,
 lease_token=null,lease_until=null,desired_plan=null;
-- Historical PayMongo columns and quote tables remain private for auditing.
create or replace function public.billing_claim(p_user uuid,p_event text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare row public.billing_customers; token uuid:=gen_random_uuid();
begin
 select * into row from public.billing_customers where user_id=p_user for update;
 if not found then raise exception 'Billing customer missing'; end if;
 if p_event is not null and exists(select 1 from public.billing_events where event_id=p_event) then return jsonb_build_object('processed',true); end if;
 if row.lease_until>now() then return jsonb_build_object('busy',true); end if;
 update public.billing_customers set lease_token=token,lease_until=now()+interval '90 seconds' where user_id=p_user;
 return jsonb_build_object('token',token,'customer',row.stripe_customer_id,'checkout',row.checkout_session_id,'checkout_plan',row.checkout_plan);
end $$;

drop function public.reset_legacy_test_billing();
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  execute 'select cron.unschedule(jobid) from cron.job where jobname = ''revbaze-billing-renewals''';
 end if;
end $$;
