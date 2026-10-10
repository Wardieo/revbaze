-- Connection setup only; event delivery is not enabled by this migration.
create table public.integration_connections (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 provider text not null check(provider in ('zapier','make','n8n','webhook')),
 destination_url text not null check(destination_url ~ '^https://[^[:space:]]+$'),
 events text[] not null check(cardinality(events)>0 and events <@ array['card.viewed','link.clicked','card.created','card.updated']::text[]),
 updated_at timestamptz not null default now(),
 unique(business_id,provider)
);
alter table public.integration_connections enable row level security;
create policy integration_setup_read on public.integration_connections for select to authenticated using(public.owns_business(business_id));
revoke all on public.integration_connections from public,anon,authenticated;
grant select on public.integration_connections to authenticated;
grant all on public.integration_connections to service_role;
create function public.save_integration_setup(p_business_id uuid,p_provider text,p_destination_url text,p_events text[]) returns void language plpgsql security definer set search_path=public as $$
declare owner uuid;
begin
 if auth.uid() is null or not public.owns_business(p_business_id) then raise exception 'Only the business owner can manage integrations'; end if;
 select owner_id into owner from public.businesses where id=p_business_id;
 if public.effective_account_plan(owner)='free' then raise exception 'Integrations require Growth or Pro'; end if;
 insert into public.integration_connections(business_id,provider,destination_url,events) values(p_business_id,p_provider,p_destination_url,p_events)
 on conflict(business_id,provider) do update set destination_url=excluded.destination_url,events=excluded.events,updated_at=now();
end $$;
create function public.remove_integration_setup(p_business_id uuid,p_provider text) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.owns_business(p_business_id) then raise exception 'Only the business owner can manage integrations'; end if;
 delete from public.integration_connections where business_id=p_business_id and provider=p_provider;
end $$;
revoke all on function public.save_integration_setup(uuid,text,text,text[]),public.remove_integration_setup(uuid,text) from public,anon;
grant execute on function public.save_integration_setup(uuid,text,text,text[]),public.remove_integration_setup(uuid,text) to authenticated;
