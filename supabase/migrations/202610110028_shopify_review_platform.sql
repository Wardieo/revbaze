-- Add Shopify separately so workspaces that applied the category catalog also receive it.
insert into public.review_platforms(id,name,slug,icon,allowed_domains)
values ('shopify','Shopify','shopify','SH',array['myshopify.com'])
on conflict(id) do update set name=excluded.name, icon=excluded.icon, allowed_domains=excluded.allowed_domains;
