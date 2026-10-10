-- Preserve the selected card background during onboarding publication.
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
 perform public.save_review_card(jsonb_build_object('id',d.card_id,'business_id',d.business_id,'name',b->>'name'||' review card','slug',c->>'slug','headline',c->>'headline','description',c->>'description','appearance_settings',jsonb_build_object('template',coalesce(c->>'template','classic'),'business_name',b->>'name','logo_url',coalesce(b->>'logo_url',''),'accent',c->>'accent','background',coalesce(c->>'background','#ffffff'),'border_style',coalesce(c->>'border_style','solid'),'border_color',coalesce(c->>'border_color','#e5e9ef'),'button_style',c->>'button_style','radius',c->>'radius'),'is_active',true,'links',card_links));
 update public.review_cards set published_at=now() where id=d.card_id returning * into card;
 update public.businesses set onboarding_completed_at=now() where id=d.business_id;
 update public.onboarding_drafts set completed_at=now(),step=5,revision=revision+1,updated_at=now() where id=d.id returning * into d;
 return jsonb_build_object('draft',to_jsonb(d),'card',to_jsonb(card));
end $$;

revoke all on function public.publish_onboarding(uuid,integer) from public,anon;
grant execute on function public.publish_onboarding(uuid,integer) to authenticated;

alter table public.review_cards add constraint review_card_border_style_check check(coalesce(appearance_settings->>'border_style','solid') in ('none','solid','dashed'));
alter table public.review_cards add constraint review_card_border_color_check check(coalesce(appearance_settings->>'border_color','#e5e9ef') ~ '^#[0-9a-fA-F]{6}$');
-- Extend the existing explicit public projection, retaining every publication check.
do $migration$
declare target regprocedure; definition text;
begin
 target:=coalesce(to_regprocedure('public.published_review_card_before_plan_limits(text)'),to_regprocedure('public.published_review_card(text)'));
 definition:=pg_get_functiondef(target);
 definition:=replace(definition,'''background'',c.appearance_settings->>''background''', '''background'',c.appearance_settings->>''background'',''border_style'',c.appearance_settings->>''border_style'',''border_color'',c.appearance_settings->>''border_color''');
 execute definition;
end $migration$;
