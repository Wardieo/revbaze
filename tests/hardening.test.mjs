import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text default 'hash',raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb default '{}');
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
grant usage on schema storage to authenticated; grant insert on storage.objects to authenticated;
`);
for (const name of (await readdir("supabase/migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  try {
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  } catch (error) {
    throw new Error(`Migration ${name}: ${error.message}`);
  }
}
const owner = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const business = "10000000-0000-4000-8000-000000000001",
  card = "20000000-0000-4000-8000-000000000001";
await db.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
  owner,
  "owner@example.com",
  other,
  "other@example.com",
]);
await db.query(
  "insert into public.account_plans(user_id,plan) values($1,'pro')",
  [owner],
);
await db.query(
  "insert into public.businesses(id,owner_id,name,slug,onboarding_completed_at) values($1,$2,'Test','test-business',now())",
  [business, owner],
);
await db.query(
  `insert into public.review_cards(id,business_id,name,slug,headline,appearance_settings) values($1,$2,'Test','test-card','Review us','{"accent":"#042751","background":"#ffffff"}')`,
  [card, business],
);
const day = new Date().toISOString().slice(0, 10);
// The same visitor on two days must count once for the whole range.
for (const [ago, visitor] of [
  [0, "a"],
  [1, "a"],
  [0, "b"],
]) {
  await db.query(
    "insert into public.review_card_events(review_card_id,event_type,created_at,visitor_key,traffic_source) values($1,'page_view',now()-make_interval(days=>$2),$3,'qr')",
    [card, ago, visitor.repeat(64)],
  );
}
async function as(user) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
}
await as(owner);
const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const summary = (
  await db.query("select public.analytics_summary($1,$2,$3,'UTC') as value", [
    business,
    from,
    day,
  ])
).rows[0].value;
assert.equal(
  summary.events.length,
  2,
  "Return daily aggregates without visitor identifiers",
);
assert.equal(
  summary.events.reduce((sum, e) => sum + e.count, 0),
  3,
);
assert.equal(
  summary.unique.find((v) => v.period === "current" && v.scope === "total")
    .count,
  2,
  "Do not sum daily distinct visitors",
);
assert.equal(summary.unique.find((v) => v.scope === "source").count, 2);
assert(summary.events.every((e) => !e.visitor_key));
const filtered = (
  await db.query(
    "select public.analytics_summary($1,$2,$3,'UTC',null,null,'missing') as value",
    [business, from, day],
  )
).rows[0].value;
assert.deepEqual(filtered.events, []);
assert.equal(
  (
    await db.query(
      "select public.business_comparison_summary($1,$2,'UTC') as value",
      [from, day],
    )
  ).rows[0].value[0].visitors,
  2,
);
assert.equal(
  (
    await db.query("select public.workspace_overview_summary($1) as value", [
      business,
    ])
  ).rows[0].value.reduce((sum, e) => sum + e.count, 0),
  3,
);
await as(other);
await assert.rejects(
  db.query("select public.analytics_summary($1,$2,$3,'UTC')", [
    business,
    from,
    day,
  ]),
  /access denied/,
);
await db.exec("set role anon");
await assert.rejects(
  db.query("select public.analytics_summary($1,$2,$3,'UTC')", [
    business,
    from,
    day,
  ]),
  /permission denied/,
);
await db.exec("reset role");
const source = "c".repeat(64);
for (let n = 0; n < 20; n++)
  assert.equal(
    (
      await db.query("select public.allow_tracking_request($1,$2) as allowed", [
        source,
        "test-card",
      ])
    ).rows[0].allowed,
    true,
  );
assert.equal(
  (
    await db.query("select public.allow_tracking_request($1,$2) as allowed", [
      source,
      "test-card",
    ])
  ).rows[0].allowed,
  false,
);
assert.equal(
  (
    await db.query("select public.allow_tracking_request($1,$2) as allowed", [
      "d".repeat(64),
      "test-card",
    ])
  ).rows[0].allowed,
  true,
  "One caller cannot exhaust all callers",
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
const image = crypto.randomUUID();
const path = (
  await db.query(
    "select public.reserve_image_upload($1,$2,'business-assets',$3,1024,'png') as path",
    [owner, business, image],
  )
).rows[0].path;
await db.query(
  "insert into storage.objects(bucket_id,name,metadata) values('business-assets',$1,'{\"size\":1024}')",
  [path],
);
await db.query("select public.complete_image_upload($1)", [image]);
const url = `https://fixture.supabase.co/storage/v1/object/public/business-assets/${path}`;
await db.query("update public.businesses set logo_url=$1 where id=$2", [
  url,
  business,
]);
await db.exec(
  "update public.managed_assets set created_at=now()-interval '2 days'",
);
assert.equal(
  (await db.query("select * from public.claim_unused_assets()")).rows.length,
  0,
  "Referenced files survive cleanup",
);
// A second reference must also prevent retirement.
await db.query(
  "update public.review_cards set appearance_settings=appearance_settings||jsonb_build_object('logo_url',$1::text) where id=$2",
  [url, card],
);
await db.query("update public.businesses set logo_url='' where id=$1", [
  business,
]);
assert.equal(
  (await db.query("select * from public.claim_unused_assets()")).rows.length,
  0,
);
await db.query(
  "update public.review_cards set appearance_settings=appearance_settings-'logo_url' where id=$1",
  [card],
);
assert.equal(
  (await db.query("select * from public.claim_unused_assets()")).rows.length,
  1,
);
await assert.rejects(
  db.query("update public.businesses set logo_url=$1 where id=$2", [
    url,
    business,
  ]),
  /image is unavailable/,
);
await assert.rejects(
  db.query("update public.businesses set logo_url=$1 where id=$2", [
    url + "?cache=1",
    business,
  ]),
  /image is unavailable/,
);
await assert.rejects(
  db.query("update public.businesses set logo_url=$1 where id=$2", [
    url.replace(".png", "%2Epng"),
    business,
  ]),
  /original image URL/,
);
await db.query("select public.finish_asset_cleanup($1)", [image]);
await assert.rejects(
  db.query(
    "select public.reserve_image_upload($1,$2,'business-assets',$3,1024,'png')",
    [other, business, crypto.randomUUID()],
  ),
  /access denied/,
);
await as(owner);
await assert.rejects(
  db.query(
    "insert into storage.objects(bucket_id,name) values('business-assets',$1)",
    [`${business}/bypass.png`],
  ),
  /row-level security/,
);
await db.exec("reset role");
// Quotas reserve bytes before concurrent upload work; pending uploads count too.
await db.query(
  "insert into public.managed_assets(owner_id,actor_id,bucket,name,bytes,status) values($1,$1,'profile-assets','quota-fixture',524288000,'reserved')",
  [owner],
);
await assert.rejects(
  db.query(
    "select public.reserve_image_upload($1,null,'profile-assets',$2,1024,'png')",
    [owner, crypto.randomUUID()],
  ),
  /allowance reached/,
);

await db.query(
  "update public.managed_assets set status='deleted' where name='quota-fixture'",
);
const parallel = await Promise.allSettled(
  Array.from({ length: 12 }, () =>
    db.query(
      "select public.reserve_image_upload($1,null,'profile-assets',$2,1024,'png')",
      [other, crypto.randomUUID()],
    ),
  ),
);
assert.equal(parallel.filter((item) => item.status === "fulfilled").length, 10);
assert.equal(parallel.filter((item) => item.status === "rejected").length, 2);
const profileId = crypto.randomUUID();
const profilePath = (
  await db.query(
    "select public.reserve_image_upload($1,null,'profile-assets',$2,1024,'png') as path",
    [owner, profileId],
  )
).rows[0].path;
await db.query(
  "insert into storage.objects(bucket_id,name) values('profile-assets',$1)",
  [profilePath],
);
await db.query("select public.complete_image_upload($1)", [profileId]);
const avatar = `https://fixture.supabase.co/storage/v1/object/public/profile-assets/${profilePath}`;
await db.query(
  "update auth.users set raw_user_meta_data=jsonb_build_object('avatar_url',$1::text) where id=$2",
  [avatar, owner],
);
await db.query(
  "update public.managed_assets set created_at=now()-interval '2 days' where id=$1",
  [profileId],
);
assert(
  !(await db.query("select * from public.claim_unused_assets()")).rows.some(
    (row) => row.id === profileId,
  ),
  "Referenced avatars survive cleanup",
);
await db.query("update auth.users set raw_user_meta_data='{}' where id=$1", [
  owner,
]);
assert(
  (await db.query("select * from public.claim_unused_assets()")).rows.some(
    (row) => row.id === profileId,
  ),
);
await assert.rejects(
  db.query(
    "update auth.users set raw_user_meta_data=jsonb_build_object('avatar_url',$1::text) where id=$2",
    [avatar, owner],
  ),
  /image is unavailable/,
);
await as(owner);
const onlyToday = (
  await db.query("select public.analytics_summary($1,$2,$2,'UTC') as value", [
    business,
    day,
  ])
).rows[0].value;
assert.equal(
  onlyToday.unique.find((v) => v.period === "current" && v.scope === "total")
    .count,
  2,
);
assert.equal(
  onlyToday.unique.find((v) => v.period === "previous" && v.scope === "total")
    .count,
  1,
);
const performance = (
  await db.query("select public.card_performance_summary($1) as value", [
    business,
  ])
).rows[0].value;
assert.equal(
  performance.reduce((sum, e) => sum + e.count, 0),
  3,
);
console.log(
  "PASS: complete migration replay, bounded aggregates, exact unique visitors, tenant isolation, layered tracking limits, direct-upload denial, quotas, shared references and safe asset retirement.",
);
await db.close();
