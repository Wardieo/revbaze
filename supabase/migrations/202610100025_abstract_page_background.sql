alter table public.review_cards drop constraint review_card_background_style_check;
alter table public.review_cards add constraint review_card_background_style_check check(coalesce(appearance_settings->>'background_style','solid') in ('solid','gradient','dots','abstract','waves'));
