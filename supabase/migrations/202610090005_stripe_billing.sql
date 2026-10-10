-- Apply after 004. Entitlements are written only by verified server-side billing.
create table public.billing_customers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 stripe_customer_id text not null unique check (stripe_customer_id like 'cus_%'),
 subscription_id text, status text, period_end timestamptz, cancel_at_period_end boolean not null default false,
 checkout_session_id text, checkout_plan text, lease_token uuid, lease_until timestamptz,
 updated_at timestamptz not null default now()
);
create table public.billing_events (
 event_id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 processed_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
alter table public.billing_events enable row level security;
revoke all on public.billing_customers, public.billing_events from public, anon, authenticated;
grant all on public.billing_customers, public.billing_events to service_role;

-- A lease serializes fresh Stripe reads and checkout creation for an account.
-- Failed/expired workers cannot overwrite a newer worker's state.
create function public.billing_claim(p_user uuid,p_event text default null) returns jsonb
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
create function public.billing_release(p_user uuid,p_token uuid,p_checkout text default null,p_plan text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 update public.billing_customers set lease_token=null,lease_until=null,
 checkout_session_id=coalesce(p_checkout,checkout_session_id),checkout_plan=coalesce(p_plan,checkout_plan),updated_at=now()
 where user_id=p_user and lease_token=p_token and lease_until>now();
 if not found then raise exception 'Billing operation expired; retry'; end if;
end $$;
create function public.billing_apply(p_user uuid,p_token uuid,p_event text,p_plan text,p_subscription text,p_status text,p_period_end timestamptz,p_cancel boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.billing_customers where user_id=p_user and lease_token=p_token and lease_until>now() for update;
 if not found then raise exception 'Billing operation expired; retry'; end if;
 if p_plan not in ('free','growth','pro') or (p_plan<>'free' and (p_period_end is null or p_period_end<=now() or p_status not in ('active','trialing'))) then raise exception 'Invalid subscription entitlement'; end if;
 insert into public.account_plans(user_id,plan,expires_at) values(p_user,p_plan,case when p_plan='free' then null else p_period_end end)
 on conflict(user_id) do update set plan=excluded.plan,expires_at=excluded.expires_at;
 update public.billing_customers set subscription_id=p_subscription,status=p_status,period_end=p_period_end,cancel_at_period_end=p_cancel,
 lease_token=null,lease_until=null,updated_at=now() where user_id=p_user;
 insert into public.billing_events(event_id,user_id) values(p_event,p_user);
end $$;
revoke all on function public.billing_claim(uuid,text),public.billing_release(uuid,uuid,text,text),public.billing_apply(uuid,uuid,text,text,text,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.billing_claim(uuid,text),public.billing_release(uuid,uuid,text,text),public.billing_apply(uuid,uuid,text,text,text,text,timestamptz,boolean) to service_role;
