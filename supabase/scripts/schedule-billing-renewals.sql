-- Store revbaze_project_url and revbaze_billing_renewal_secret in Vault first.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='revbaze_billing_renewal_secret') or not exists(select 1 from vault.decrypted_secrets where name='revbaze_project_url') then raise exception 'Configure billing worker Vault secrets first'; end if;
end $$;
select cron.schedule('revbaze-billing-renewals','*/5 * * * *',$$
 select net.http_post(url:=(select decrypted_secret from vault.decrypted_secrets where name='revbaze_project_url')||'/functions/v1/billing-renewals',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='revbaze_billing_renewal_secret')),body:='{}'::jsonb,timeout_milliseconds:=30000);
$$);
