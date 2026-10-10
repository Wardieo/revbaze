-- Contact inbox is private. Public submissions go through the validated Edge Function.
create table public.contact_messages (
 id uuid primary key,
 name text not null check(length(name) between 1 and 100),
 email text not null check(length(email) between 3 and 254),
 topic text not null check(topic in ('Product question','Product feedback','Plans & pricing','Something else')),
 message text not null check(length(message) between 10 and 3000),
 created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from public,anon,authenticated;
grant all on public.contact_messages to service_role;
create table public.contact_submission_limits (
 bucket text primary key,
 window_start timestamptz not null,
 submissions integer not null
);
alter table public.contact_submission_limits enable row level security;
revoke all on public.contact_submission_limits from public,anon,authenticated;
grant all on public.contact_submission_limits to service_role;
create function public.submit_contact_message(p_id uuid,p_name text,p_email text,p_topic text,p_message text,p_source_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare bucket_key text; used integer;
begin
 -- Serialize retries and limits across Edge Function instances.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,18));
 if exists(select 1 from public.contact_messages where id=p_id) then return p_id; end if;
 for bucket_key in select key from unnest(array['email:'||lower(trim(p_email)), 'source:'||p_source_hash]) key order by key loop
  insert into public.contact_submission_limits(bucket,window_start,submissions) values(bucket_key,now(),1)
  on conflict(bucket) do update set
   submissions=case when contact_submission_limits.window_start<now()-interval '1 hour' then 1 else contact_submission_limits.submissions+1 end,
   window_start=case when contact_submission_limits.window_start<now()-interval '1 hour' then now() else contact_submission_limits.window_start end
  returning submissions into used;
  if used>5 then raise exception 'Contact submission limit reached' using errcode='P0001'; end if;
 end loop;
 insert into public.contact_messages(id,name,email,topic,message) values(p_id,trim(p_name),lower(trim(p_email)),p_topic,trim(p_message));
 delete from public.contact_submission_limits where window_start<now()-interval '2 days';
 return p_id;
end $$;
revoke all on function public.submit_contact_message(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_contact_message(uuid,text,text,text,text,text) to service_role;
