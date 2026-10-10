-- Active cards saved in an onboarded workspace are immediately shareable.
-- Onboarding drafts remain private until the atomic publication RPC completes.
create function public.set_review_card_publication() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.is_active and new.published_at is null and exists(
  select 1 from public.businesses where id=new.business_id and onboarding_completed_at is not null
 ) then new.published_at:=now(); end if;
 return new;
end $$;
revoke all on function public.set_review_card_publication() from public,anon,authenticated;
create trigger review_card_publication before insert or update on public.review_cards
 for each row execute function public.set_review_card_publication();
update public.review_cards c set published_at=now()
 where c.is_active and c.published_at is null
 and exists(select 1 from public.businesses b where b.id=c.business_id and b.onboarding_completed_at is not null);
