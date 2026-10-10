-- Apply after migrations 001 and 002. Existing ownership policies remain in force.
update storage.buckets set file_size_limit = 10485759,
 allowed_mime_types = array['image/png','image/jpeg']
 where id in ('business-assets','profile-assets');
alter table public.review_cards add constraint review_cards_template_check
 check (coalesce(appearance_settings->>'template','classic') in ('classic','left','split','grid'));
create or replace function public.publish_onboarding(p_id uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.onboarding_drafts; b jsonb; c jsonb; item jsonb; order_index integer:=0; card_links jsonb:='[]'; link_id uuid; card public.review_cards;
begin
 select * into d from public.onboarding_drafts where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Draft access denied'; end if;
 if d.completed_at is not null then
  select * into card from public.review_cards where id=d.card_id;
  return jsonb_build_object('draft',to_jsonb(d),'card',to_jsonb(card));
 end if;
 if d.revision<>p_revision then raise exception 'Draft changed in another tab. Reload to resume the latest saved version.'; end if;
 b:=d.draft->'business'; c:=d.draft->'card';
 if d.step<>4 or length(trim(coalesce(d.draft->>'name','')))<1 or length(trim(coalesce(b->>'name','')))<1 or length(trim(coalesce(b->>'category','')))<1 then raise exception 'Complete your account and business information first'; end if;
 if not public.owns_business(d.business_id) then raise exception 'Business ownership required'; end if;
 perform public.save_business(b || jsonb_build_object('id',d.business_id,'slug',coalesce((select slug from public.businesses where id=d.business_id),'workspace-'||replace(d.business_id::text,'-',''))));
 if jsonb_typeof(d.draft->'links') is distinct from 'array' or jsonb_array_length(d.draft->'links') not between 1 and 20 then raise exception 'Add at least one valid review platform (maximum 20)'; end if;
 for item in select value from jsonb_array_elements(d.draft->'links') loop
  link_id:=(item->>'id')::uuid;
  perform public.save_review_link(item || jsonb_build_object('business_id',d.business_id,'is_active',true));
  card_links:=card_links||jsonb_build_array(jsonb_build_object('business_review_link_id',link_id,'display_order',order_index,'is_enabled',true));
  order_index:=order_index+1;
 end loop;
 if coalesce(c->>'slug','') in ('overview','signup','check-email','forgot-password','reset-password','review','admin','api','app','login','settings','cards','analytics','onboarding','platforms','qr-codes','profile','auth','support') then raise exception 'This URL is reserved'; end if;
 perform public.save_review_card(jsonb_build_object('id',d.card_id,'business_id',d.business_id,'name',b->>'name'||' review card','slug',c->>'slug','headline',c->>'headline','description',c->>'description','appearance_settings',jsonb_build_object('template',coalesce(c->>'template','classic'),'business_name',b->>'name','logo_url',coalesce(b->>'logo_url',''),'accent',c->>'accent','background','#ffffff','button_style',c->>'button_style','radius',c->>'radius'),'is_active',true,'links',card_links));
 update public.review_cards set published_at=now() where id=d.card_id returning * into card;
 update public.businesses set onboarding_completed_at=now() where id=d.business_id;
 update public.onboarding_drafts set completed_at=now(),step=5,revision=revision+1,updated_at=now() where id=d.id returning * into d;
 return jsonb_build_object('draft',to_jsonb(d),'card',to_jsonb(card));
end $$;
-- Anonymous access exposes only the explicit published customer-facing projection.
create or replace function public.published_review_card(p_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',c.id,'slug',c.slug,'headline',c.headline,'description',c.description,'appearance_settings',jsonb_build_object('template',coalesce(c.appearance_settings->>'template','classic'),'business_name',c.appearance_settings->>'business_name','logo_url',c.appearance_settings->>'logo_url','accent',c.appearance_settings->>'accent','background',c.appearance_settings->>'background','button_style',c.appearance_settings->>'button_style','radius',c.appearance_settings->>'radius'),
 'destinations',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'platform_id',l.platform_id,'display_name',l.display_name,'destination_url',l.destination_url) order by cl.display_order) from public.review_card_links cl join public.business_review_links l on l.id=cl.business_review_link_id where cl.review_card_id=c.id and cl.is_enabled and l.is_active),'[]'::jsonb))
 from public.review_cards c where c.slug=p_slug and c.is_active and c.published_at is not null
 and exists(select 1 from public.review_card_links cl join public.business_review_links l on l.id=cl.business_review_link_id where cl.review_card_id=c.id and cl.is_enabled and l.is_active)
$$;
