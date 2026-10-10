import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
for (const file of [
  "202610080001_review_link_management.sql",
  "202610080002_onboarding_publication.sql",
  "202610080003_onboarding_templates_assets.sql",
  "202610090004_plan_access.sql",
])
  await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
const owner = "00000000-0000-4000-8000-000000000001",
  member = "00000000-0000-4000-8000-000000000002";
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
await db.query("insert into auth.users(id) values($1),($2)", [owner, member]);
async function as(user = owner) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
}
async function assign(plan, expired = false) {
  await db.exec("reset role");
  await db.query(
    "insert into public.account_plans(user_id,plan,expires_at) values($1,$2,case when $3 then now()-interval '1 day' else null end) on conflict(user_id) do update set plan=excluded.plan,expires_at=excluded.expires_at",
    [owner, plan, expired],
  );
  await as();
}
async function rpc(name, args) {
  return (
    await db.query(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as value`,
      args,
    )
  ).rows[0].value;
}
async function business(n) {
  return rpc("save_business", [
    JSON.stringify({
      id: id(n),
      name: "Business " + n,
      slug: "business-" + n,
      brand_color: "#4b7fe7",
    }),
  ]);
}
async function link(n, business = 1) {
  return rpc("save_review_link", [
    JSON.stringify({
      id: id(n),
      business_id: id(business),
      platform_id: "custom",
      display_name: "Link " + n,
      destination_url: "https://example.com/review",
      is_active: true,
    }),
  ]);
}
async function card(n, business = 1, links = [11, 12, 13]) {
  return rpc("save_review_card", [
    JSON.stringify({
      id: id(n),
      business_id: id(business),
      name: "Card " + n,
      slug: "card-" + n,
      headline: "Share your experience",
      description: "",
      appearance_settings: {
        accent: "#4b7fe7",
        background: "#ffffff",
        button_style: "outline",
        radius: "rounded",
      },
      is_active: true,
      links: links.map((n, i) => ({
        business_review_link_id: id(n),
        display_order: i,
        is_enabled: true,
      })),
    }),
  ]);
}
await as();
assert.equal((await rpc("account_plan_status", [null])).plan, "free");
await business(1);
await assert.rejects(business(2), /business limit reached/);
for (const n of [11, 12, 13, 14]) await link(n);
await assert.rejects(card(21, 1, [11, 12, 13, 14]), /3 enabled/);
assert.equal(
  (await db.query("select count(*)::int as n from public.review_cards")).rows[0]
    .n,
  0,
  "failed link save must roll back card",
);
await card(21);
await assert.rejects(card(22), /review card limit/);
await assert.rejects(
  db.query("insert into public.account_plans(user_id,plan) values($1,'pro')", [
    owner,
  ]),
  /permission denied/,
);
await assert.rejects(
  db.query("update public.account_plans set plan='pro' where user_id=$1", [
    owner,
  ]),
  /permission denied/,
);
await assert.rejects(
  db.query("delete from public.account_plans where user_id=$1", [owner]),
  /permission denied/,
);
await assert.rejects(
  rpc("effective_account_plan", [owner]),
  /permission denied/,
);
await assert.rejects(rpc("account_plan_status", [id(99)]), /access denied/);
await assign("growth");
await business(2);
await assert.rejects(business(3), /business limit/);
await link(15, 2);
await card(22, 2, [15]);
await card(23);
await card(24);
await card(25);
await assert.rejects(card(26), /review card limit/);
await card(21, 1, [11, 12, 13, 14]);
assert.equal((await rpc("account_plan_status", [id(1)])).workspace_cards, 5);
await assign("pro");
await business(3);
await card(26);
await db.exec("reset role");
await db.query(
  "insert into public.business_members(business_id,user_id,role) values($1,$2,'editor')",
  [id(1), member],
);
await as(member);
const shared = await rpc("account_plan_status", [id(1)]);
assert.equal(shared.plan, "free");
assert.equal(shared.workspace_plan, "pro");
await card(27);
await db.exec("reset role");
for (const [n, months] of [
  [31, 11],
  [32, 13],
  [33, 25],
])
  await db.query(
    "insert into public.review_card_events(id,review_card_id,event_type,created_at) values($1,$2,'page_view',now()-($3||' months')::interval)",
    [id(n), id(21), months],
  );
await assign("growth");
assert.equal(
  (await db.query("select * from public.review_card_events")).rows.length,
  1,
);
assert.equal(
  (await db.query("select * from public.workspace_events($1)", [id(1)])).rows
    .length,
  1,
);
await assign("pro");
assert.equal(
  (await db.query("select * from public.review_card_events")).rows.length,
  2,
);
assert.equal(
  (await db.query("select * from public.workspace_events($1)", [id(1)])).rows
    .length,
  2,
);
await assign("pro", true);
assert.equal((await rpc("account_plan_status", [null])).plan, "free");
assert.equal(
  (await db.query("select * from public.review_card_events")).rows.length,
  0,
);
assert.equal(
  (await db.query("select * from public.workspace_events($1)", [id(1)])).rows
    .length,
  0,
);
await assert.rejects(business(4), /business limit/);
await assert.rejects(card(28), /review card limit/);
// Downgrades keep existing data; editing down to Free's destinations remains possible.
await card(21, 1, [11, 12, 13]);
await as(member);
await assert.rejects(
  db
    .query("select * from public.account_plans where user_id=$1", [owner])
    .then((r) => {
      if (r.rows.length === 0) throw new Error("owner plan hidden");
    }),
  /owner plan hidden/,
);
await db.exec("reset role");
await db.query("delete from public.account_plans where user_id=$1", [owner]);
await as();
assert.equal((await rpc("account_plan_status", [null])).plan, "free");
await db.exec("reset role; set role anon");
await assert.rejects(rpc("account_plan_status", [null]), /permission denied/);
await db.exec("reset role");
await db.exec(
  await readFile(
    "supabase/migrations/202610090008_visitor_analytics.sql",
    "utf8",
  ),
);
await db.query("insert into account_plans(user_id,plan) values($1,'growth')", [
  owner,
]);
const visitorKey = "a".repeat(64);
for (let i = 0; i < 2; i++)
  await db.query(
    "select public.ingest_visitor_event($1,$2,'page_view',null,null,$3,'qr')",
    [crypto.randomUUID(), id(21), visitorKey],
  );
await db.query(
  "select public.ingest_visitor_event($1,$2,'page_view',null,'example.com',$3,null)",
  [crypto.randomUUID(), id(21), "b".repeat(64)],
);
await as();
const rows = (
  await db.query("select * from workspace_visitor_events($1)", [id(1)])
).rows.filter((row) => row.visitor_key);
assert.equal(
  rows.reduce((sum, row) => sum + Number(row.count), 0),
  3,
);
assert.equal(new Set(rows.map((row) => row.visitor_key)).size, 2);
assert.equal(rows.find((row) => row.traffic_source === "qr").count, 2);
await assert.rejects(
  db.query("select public.ingest_visitor_event($1,$2,'page_view')", [
    crypto.randomUUID(),
    id(21),
  ]),
  /permission denied/,
);
await db.exec("reset role");
await db.query("update account_plans set plan='free' where user_id=$1", [
  owner,
]);
await as();
assert.equal(
  (await db.query("select * from workspace_visitor_events($1)", [id(1)])).rows
    .length,
  0,
);
await db.exec("reset role;set role anon");
await assert.rejects(
  db.query("select * from workspace_visitor_events($1)", [id(1)]),
  /permission denied/,
);
console.log(
  "PASS: visitor aggregation deduplicates repeated browser visits, preserves source totals, and enforces paid/anonymous access.",
);
await db.exec("reset role");
await db.exec(
  await readFile(
    "supabase/migrations/202610090009_edit_review_platform.sql",
    "utf8",
  ),
);
const trackedClick = crypto.randomUUID();
await db.query("select public.ingest_review_event($1,$2,'outbound_click',$3)", [
  trackedClick,
  id(21),
  id(11),
]);
await as();
const editLink = (
  await db.query("select * from business_review_links where id=$1", [id(11)])
).rows[0];
await db.query("select public.save_review_link($1::jsonb)", [
  JSON.stringify({
    ...editLink,
    platform_id: "facebook",
    destination_url: "https://www.facebook.com/reviews",
  }),
]);
assert.equal(
  (
    await db.query(
      "select platform_id from business_review_links where id=$1",
      [id(11)],
    )
  ).rows[0].platform_id,
  "facebook",
);
await assert.rejects(
  db.query("select public.save_review_link($1::jsonb)", [
    JSON.stringify({
      ...editLink,
      platform_id: "yelp",
      destination_url: "https://facebook.com/reviews",
    }),
  ]),
  /Invalid HTTPS/,
);
assert.equal(
  (
    await db.query("select platform_id from review_card_events where id=$1", [
      trackedClick,
    ])
  ).rows.length,
  0,
  "Free still cannot read events",
);
await db.exec("reset role");
assert.equal(
  (
    await db.query("select platform_id from review_card_events where id=$1", [
      trackedClick,
    ])
  ).rows[0].platform_id,
  editLink.platform_id,
  "Historical attribution remains the original provider",
);
console.log(
  "PASS: platform editing retains destination IDs and validates the newly selected provider domain.",
);
await db.exec("reset role");
await db.exec(
  await readFile(
    "supabase/migrations/202610090010_integration_setup.sql",
    "utf8",
  ),
);
await assign("free");
await assert.rejects(
  rpc("save_integration_setup", [
    id(1),
    "make",
    "https://example.com/hook",
    ["link.clicked"],
  ]),
  /Growth or Pro/,
);
await assign("growth");
await rpc("save_integration_setup", [
  id(1),
  "make",
  "https://example.com/hook",
  ["link.clicked"],
]);
assert.equal(
  (await db.query("select * from integration_connections")).rows.length,
  1,
);
await assert.rejects(
  rpc("save_integration_setup", [
    id(1),
    "make",
    "https://example.com/hook",
    ["invented.event"],
  ]),
  /check constraint/,
);
await as(member);
assert.equal(
  (await db.query("select * from integration_connections")).rows.length,
  0,
);
await assert.rejects(
  rpc("save_integration_setup", [
    id(1),
    "make",
    "https://example.com/hook",
    ["link.clicked"],
  ]),
  /business owner/,
);
await as(owner);
await rpc("remove_integration_setup", [id(1), "make"]);
assert.equal(
  (await db.query("select * from integration_connections")).rows.length,
  0,
);
console.log(
  "PASS: integration setup enforces owner access, paid plans, event validation, and removal.",
);
await db.exec("reset role");
await db.exec(
  await readFile(
    "supabase/migrations/202610090011_free_overview_access.sql",
    "utf8",
  ),
);
await assign("free");
const basicOverview = await db.query(
  "select * from public.free_overview_events($1)",
  [id(1)],
);
assert(basicOverview.rows.length > 0);
assert(!("visitor_key" in basicOverview.rows[0]));
assert(!("business_review_link_id" in basicOverview.rows[0]));
await assert.rejects(link(999), /1 review platform/);
await as(member);
await db.exec("select set_config('request.jwt.claim.sub','',false)");
assert.equal(
  (await db.query("select * from public.free_overview_events($1)", [id(1)]))
    .rows.length,
  0,
);
console.log(
  "PASS: Free receives only Overview totals and cannot add a second destination.",
);
await db.exec("reset role");
await db.exec(
  await readFile(
    "supabase/migrations/202610090012_analytics_timezones.sql",
    "utf8",
  ),
);
await assign("growth");
const timezoneRows = (
  await db.query(
    "select * from public.workspace_timezone_events($1,'America/New_York')",
    [id(1)],
  )
).rows;
assert(timezoneRows.length > 0);
assert.equal(
  timezoneRows.reduce((sum, r) => sum + Number(r.count), 0),
  (
    await db.query("select * from public.workspace_visitor_events($1)", [id(1)])
  ).rows.reduce((sum, r) => sum + Number(r.count), 0),
);
await assert.rejects(
  db.query(
    "select * from public.workspace_timezone_events($1,'Invalid/Zone')",
    [id(1)],
  ),
  /Invalid reporting timezone/,
);
await assign("free");
assert.equal(
  (
    await db.query("select * from public.workspace_timezone_events($1,'UTC')", [
      id(1),
    ])
  ).rows.length,
  0,
);
await db.exec("reset role; set role anon");
await assert.rejects(
  db.query("select * from public.workspace_timezone_events($1,'UTC')", [id(1)]),
  /permission denied/,
);
console.log(
  "PASS: timezone analytics preserves totals, validates zones, and enforces paid and anonymous access.",
);
await db.exec("reset role");
await db.exec(
  await readFile(
    "supabase/migrations/202610090013_downgrade_access.sql",
    "utf8",
  ),
);
await assign("pro");
await business(800);
await link(801, 800);
await card(802, 800, [801]);
await db.exec("reset role");
await db.query(
  "update businesses set onboarding_completed_at=now() where id=$1",
  [id(800)],
);
await db.query("update review_cards set published_at=now() where id=$1", [
  id(802),
]);
await as();
assert(await rpc("published_review_card", ["card-802"]));
await assign("free");
assert.equal(await rpc("published_review_card", ["card-802"]), null);
const pausedStatus = await rpc("downgrade_access_status", []);
assert.equal(pausedStatus.businesses.filter((b) => b.available).length, 1);
assert.equal(pausedStatus.cards.filter((c) => c.available).length, 1);
assert(pausedStatus.cards.some((c) => c.id === id(802) && !c.available));
await assert.rejects(card(802, 800, [801]), /paused/);
await rpc("select_free_plan_items", [id(800), id(802), id(801)]);
assert(
  (await rpc("published_review_card", ["card-802"])).destinations.length === 1,
);
await assert.rejects(
  rpc("select_free_plan_items", [id(1), id(802), id(801)]),
  /Choose your own/,
);
await as(member);
await assert.rejects(
  rpc("select_free_plan_items", [id(800), id(802), id(801)]),
  /Choose your own/,
);
await db.exec("reset role; set role anon");
await assert.rejects(
  rpc("published_review_card_before_plan_limits", ["card-802"]),
  /permission denied/,
);
await assign("pro");
const restored = await rpc("downgrade_access_status", []);
assert(restored.businesses.every((b) => b.available));
assert(restored.cards.every((c) => c.available));
assert(await rpc("published_review_card", ["card-802"]));
await db.exec("reset role");
await db.query("update review_cards set is_active=false where id=$1", [
  id(802),
]);
await assign("free");
await assign("pro");
assert.equal(await rpc("published_review_card", ["card-802"]), null);
console.log(
  "PASS: downgrade pauses public access and edits, owner-only selection restores one destination, private projection cannot bypass limits, resubscription restores availability without activating inactive cards.",
);
await db.close();
console.log(
  "PASS: server Free/Growth/Pro quotas, per-card links, atomic rollback, account-wide card counts, team inheritance, protected paid assignment, expiration/downgrade, and 12/24-month analytics RLS + RPC.",
);
