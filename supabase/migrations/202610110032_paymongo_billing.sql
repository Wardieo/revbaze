-- Preserve historical records; only PayMongo IDs are used by deployed billing code.
alter table public.billing_customers rename column stripe_customer_id to legacy_customer_id;
alter table public.billing_customers alter column legacy_customer_id drop not null;
alter table public.billing_customers add column paymongo_customer_id text unique check(paymongo_customer_id like 'cus_%');
create or replace function public.billing_claim(p_user uuid,p_event text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare row public.billing_customers; token uuid:=gen_random_uuid();
begin
 insert into public.billing_customers(user_id) values(p_user) on conflict(user_id) do nothing;
 select * into row from public.billing_customers where user_id=p_user for update;
 if p_event is not null and exists(select 1 from public.billing_events where event_id=p_event) then return jsonb_build_object('processed',true); end if;
 if row.lease_until>now() then return jsonb_build_object('busy',true); end if;
 update public.billing_customers set lease_token=token,lease_until=now()+interval '90 seconds' where user_id=p_user;
 return jsonb_build_object('token',token,'customer',row.paymongo_customer_id,'checkout',row.checkout_session_id,'checkout_plan',row.checkout_plan);
end $$;
-- Explicitly invoked after an operator confirms that the old records are test-only.
-- Do not reset real subscribers through this function.
create function public.reset_legacy_test_billing() returns void language plpgsql security definer set search_path=public as $$
begin
 delete from public.account_plans where user_id in(select user_id from public.billing_customers where legacy_customer_id is not null and paymongo_customer_id is null);
 update public.billing_customers set subscription_id=null,status=null,period_end=null,cancel_at_period_end=false,checkout_session_id=null,checkout_plan=null,lease_token=null,lease_until=null where legacy_customer_id is not null and paymongo_customer_id is null;
end $$;
revoke all on function public.reset_legacy_test_billing() from public,anon,authenticated;
grant execute on function public.reset_legacy_test_billing() to service_role;
create table public.billing_fx_rates(day date primary key,rate numeric not null check(rate>0),source_updated_at timestamptz not null);
create table public.billing_quotes(day date not null,livemode boolean not null,plan text not null check(plan in ('growth','pro')),usd_amount integer not null,php_amount integer not null,rate numeric not null,provider_plan_id text unique,lease_token uuid,lease_until timestamptz,primary key(day,plan,livemode));
alter table public.billing_fx_rates enable row level security;
alter table public.billing_quotes enable row level security;
revoke all on public.billing_fx_rates,public.billing_quotes from public,anon,authenticated;
grant all on public.billing_fx_rates,public.billing_quotes to service_role;
alter table public.billing_customers add column fx_checked_at timestamptz;
alter table public.billing_customers add column desired_plan text check(desired_plan in ('growth','pro'));
create function public.billing_quote_claim(p_day date,p_live boolean,p_plan text,p_usd integer,p_php integer,p_rate numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare row public.billing_quotes; token uuid:=gen_random_uuid();
begin
 insert into public.billing_quotes(day,livemode,plan,usd_amount,php_amount,rate) values(p_day,p_live,p_plan,p_usd,p_php,p_rate) on conflict(day,plan,livemode) do nothing;
 select * into row from public.billing_quotes where day=p_day and plan=p_plan and livemode=p_live for update;
 if row.provider_plan_id is not null then return to_jsonb(row); end if;
 if row.lease_until>now() then return jsonb_build_object('busy',true); end if;
 update public.billing_quotes set lease_token=token,lease_until=now()+interval '90 seconds' where day=p_day and plan=p_plan and livemode=p_live;
 return to_jsonb(row)||jsonb_build_object('token',token);
end $$;
revoke all on function public.billing_quote_claim(date,boolean,text,integer,integer,numeric) from public,anon,authenticated;
grant execute on function public.billing_quote_claim(date,boolean,text,integer,integer,numeric) to service_role;
