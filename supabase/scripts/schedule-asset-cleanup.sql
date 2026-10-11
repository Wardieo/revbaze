-- Run after setting ASSET_CLEANUP_SECRET on the Edge Function and storing the
-- matching value in Vault as revbaze_asset_cleanup_secret. Store the project
-- origin (https://PROJECT.supabase.co) as revbaze_project_url. Never put secrets
-- in this file or in frontend VITE_ variables.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='revbaze_asset_cleanup_secret')
 or not exists(select 1 from vault.decrypted_secrets where name='revbaze_project_url') then
  raise exception 'Store revbaze_asset_cleanup_secret and revbaze_project_url in Vault first';
 end if;
end $$;
select cron.schedule('revbaze-unused-images','*/5 * * * *', $$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='revbaze_project_url')||'/functions/v1/asset-cleanup',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='revbaze_asset_cleanup_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 30000
 );
$$);
