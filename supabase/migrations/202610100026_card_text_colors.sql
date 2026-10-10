-- Validate optional card typography colors and include them in the public projection.
alter table public.review_cards add constraint review_card_text_colors_check check(
 (appearance_settings->>'title_color' is null or appearance_settings->>'title_color' ~ '^#[0-9a-fA-F]{6}$') and
 (appearance_settings->>'paragraph_color' is null or appearance_settings->>'paragraph_color' ~ '^#[0-9a-fA-F]{6}$')
);
do $migration$
declare target regprocedure; definition text;
begin
 target:=coalesce(to_regprocedure('public.published_review_card_before_plan_limits(text)'),to_regprocedure('public.published_review_card(text)'));
 definition:=pg_get_functiondef(target);
 definition:=replace(definition,'''background'',c.appearance_settings->>''background''', '''background'',c.appearance_settings->>''background'',''title_color'',c.appearance_settings->>''title_color'',''paragraph_color'',c.appearance_settings->>''paragraph_color''');
 execute definition;
end $migration$;
