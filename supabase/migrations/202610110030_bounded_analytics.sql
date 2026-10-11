-- Visitor-free daily counters for Overview; details remain private in the raw table.
create table public.event_daily_totals (
 review_card_id uuid references public.review_cards(id) on delete cascade,
 day date not null, event_type text not null, platform_id text not null default '', count bigint not null,
 primary key(review_card_id,day,event_type,platform_id)
);
alter table public.event_daily_totals enable row level security;
revoke all on public.event_daily_totals from public,anon,authenticated;
grant all on public.event_daily_totals to service_role;
insert into public.event_daily_totals
 select review_card_id,(created_at at time zone 'Asia/Manila')::date,event_type,coalesce(platform_id,''),count(*)
 from public.review_card_events group by 1,2,3,4;
create function public.update_daily_totals() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  insert into public.event_daily_totals values(new.review_card_id,(new.created_at at time zone 'Asia/Manila')::date,new.event_type,coalesce(new.platform_id,''),1)
  on conflict(review_card_id,day,event_type,platform_id) do update set count=event_daily_totals.count+1;
 else
  update public.event_daily_totals set count=count-1 where review_card_id=old.review_card_id and day=(old.created_at at time zone 'Asia/Manila')::date and event_type=old.event_type and platform_id=coalesce(old.platform_id,'');
 end if;
 return null;
end $$;
revoke all on function public.update_daily_totals() from public,anon,authenticated;
create trigger event_daily_insert after insert on public.review_card_events for each row execute function public.update_daily_totals();
create trigger event_daily_delete after delete on public.review_card_events for each row execute function public.update_daily_totals();

create function public.workspace_overview_summary(p_business_id uuid,p_days integer default 180) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare tier text; result jsonb;
begin
 if auth.uid() is null or not public.can_read_business(p_business_id) then raise exception 'Business access denied'; end if;
 if p_days<1 or p_days>180 then raise exception 'Invalid overview range'; end if;
 select public.effective_account_plan(owner_id) into tier from public.businesses where id=p_business_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',md5(t.review_card_id::text||t.day::text||t.event_type||t.platform_id),
 'review_card_id',t.review_card_id,'event_type',t.event_type,'created_at',t.day::timestamp at time zone 'Asia/Manila',
 'platform_id',case when tier='free' then null else nullif(t.platform_id,'') end,'business_review_link_id',null,'referrer',null,'count',t.count)), '[]'::jsonb)
 into result from public.event_daily_totals t join public.review_cards c on c.id=t.review_card_id
 where c.business_id=p_business_id and t.count>0 and t.day>=(now() at time zone 'Asia/Manila')::date-p_days+1
 and public.plan_card_available(c.id);
 return result;
end $$;
revoke all on function public.workspace_overview_summary(uuid,integer) from public,anon;
grant execute on function public.workspace_overview_summary(uuid,integer) to authenticated;

create function public.analytics_summary(p_business_id uuid,p_from date,p_to date,p_timezone text default 'Asia/Manila',p_card uuid default null,p_platform text default null,p_source text default null) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare tier text; lower_limit timestamptz; result jsonb;
begin
 if auth.uid() is null or not public.can_read_business(p_business_id) then raise exception 'Business access denied'; end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>730 then raise exception 'Choose a reporting range of at most 731 days'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid reporting timezone'; end if;
 if length(coalesce(p_source,''))>253 or length(coalesce(p_platform,''))>80 then raise exception 'Invalid analytics filter'; end if;
 select public.effective_account_plan(owner_id) into tier from public.businesses where id=p_business_id;
 if tier='free' then raise exception 'Analytics requires Growth or Pro'; end if;
 lower_limit:=case tier when 'growth' then now()-interval '12 months' else now()-interval '24 months' end;
 with eligible_cards as materialized (
  select id from public.review_cards where business_id=p_business_id and (p_card is null or id=p_card) and public.plan_card_available(id)
 ), eligible as materialized (
  select e.*,coalesce(nullif(e.traffic_source,''),nullif(e.referrer,''),'Direct / unknown') as source,
   (e.created_at at time zone p_timezone)::date as day,
   case when e.created_at>=p_from::timestamp at time zone p_timezone then 'current' else 'previous' end as period
  from public.review_card_events e join eligible_cards c on c.id=e.review_card_id
  where e.created_at>=greatest(lower_limit,(p_from-(p_to-p_from+1))::timestamp at time zone p_timezone)
   and e.created_at<(p_to+1)::timestamp at time zone p_timezone
   and (p_platform is null or e.event_type='page_view' or e.platform_id=p_platform)
 ), filtered as materialized (
  select * from eligible where p_source is null or source=p_source
 ), totals as (
  select review_card_id,day,event_type,platform_id,source,count(*) as n
  from filtered group by review_card_id,day,event_type,platform_id,source
 ), visitors as (
  select period,
   case when grouping(review_card_id)=0 then 'card' when grouping(source)=0 then 'source' else 'total' end as scope,
   case when grouping(review_card_id)=0 then review_card_id::text when grouping(source)=0 then source else '' end as key,
   count(distinct visitor_key) as n
  from filtered where event_type='page_view'
  group by grouping sets((period),(period,review_card_id),(period,source))
 )
 select jsonb_build_object(
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',md5(review_card_id::text||day::text||event_type||coalesce(platform_id,'')||source),
   'review_card_id',review_card_id,'created_at',day::timestamp at time zone p_timezone,'event_type',event_type,'platform_id',platform_id,
   'traffic_source',source,'business_review_link_id',null,'referrer',null,'count',n)) from totals),'[]'::jsonb),
  'unique',coalesce((select jsonb_agg(jsonb_build_object('period',period,'scope',scope,'key',key,'count',n)) from visitors),'[]'::jsonb),
  'sources',coalesce((select jsonb_agg(source) from (select source from eligible where event_type='page_view' and period='current' group by source order by count(*) desc limit 200) s),'[]'::jsonb)
 ) into result;
 if jsonb_array_length(result->'events')>20000 then raise exception 'Report is too large. Choose a shorter range or a card/source filter'; end if;
 return result;
end $$;
revoke all on function public.analytics_summary(uuid,date,date,text,uuid,text,text) from public,anon;
grant execute on function public.analytics_summary(uuid,date,date,text,uuid,text,text) to authenticated;

create function public.business_comparison_summary(p_from date,p_to date,p_timezone text default 'Asia/Manila') returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>730 then raise exception 'Invalid reporting range'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid reporting timezone'; end if;
 with allowed as materialized (
  select b.id,b.name,public.effective_account_plan(b.owner_id) as tier from public.businesses b where b.owner_id=auth.uid() and public.plan_business_available(b.id)
 ), counts as (
  select b.id,b.name,count(*) filter(where e.event_type='page_view') as views,
   count(*) filter(where e.event_type='outbound_click') as clicks,
   count(distinct e.visitor_key) filter(where e.event_type='page_view') as visitors
  from allowed b left join public.review_cards c on c.business_id=b.id and public.plan_card_available(c.id)
  left join public.review_card_events e on e.review_card_id=c.id
   and e.created_at>=greatest(p_from::timestamp at time zone p_timezone,case b.tier when 'growth' then now()-interval '12 months' else now()-interval '24 months' end)
   and e.created_at<(p_to+1)::timestamp at time zone p_timezone
  where b.tier<>'free' group by b.id,b.name
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'views',views,'clicks',clicks,'visitors',visitors,'ctr',case when views=0 then 0 else clicks::numeric/views*100 end)),'[]'::jsonb) into result from counts;
 return result;
end $$;
revoke all on function public.business_comparison_summary(date,date,text) from public,anon;
grant execute on function public.business_comparison_summary(date,date,text) to authenticated;

-- Compact card-list metrics across the plan's allowed history, without visitor rows.
create function public.card_performance_summary(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare tier text; lower_limit timestamptz; result jsonb;
begin
 if auth.uid() is null or not public.can_read_business(p_business_id) then raise exception 'Business access denied'; end if;
 select public.effective_account_plan(owner_id) into tier from public.businesses where id=p_business_id;
 if tier='free' then return '[]'::jsonb; end if;
 lower_limit:=case tier when 'growth' then now()-interval '12 months' else now()-interval '24 months' end;
 with allowed as materialized (select id from public.review_cards where business_id=p_business_id and public.plan_card_available(id)),
 counts as (
  select t.review_card_id,t.event_type,sum(t.count) as n from public.event_daily_totals t join allowed c on c.id=t.review_card_id
  where t.day>(lower_limit at time zone 'Asia/Manila')::date group by t.review_card_id,t.event_type
  union all
  select e.review_card_id,e.event_type,count(*) from public.review_card_events e join allowed c on c.id=e.review_card_id
  where e.created_at>=lower_limit and e.created_at<((lower_limit at time zone 'Asia/Manila')::date+1)::timestamp at time zone 'Asia/Manila'
  group by e.review_card_id,e.event_type
 ), combined as (select review_card_id,event_type,sum(n) as n from counts group by 1,2)
 select coalesce(jsonb_agg(jsonb_build_object('id',review_card_id::text||event_type,'review_card_id',review_card_id,'event_type',event_type,'count',n,'created_at',now(),'business_review_link_id',null,'referrer',null)),'[]'::jsonb) into result from combined;
 return result;
end $$;
revoke all on function public.card_performance_summary(uuid) from public,anon;
grant execute on function public.card_performance_summary(uuid) to authenticated;
