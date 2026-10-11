import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const source = ts.transpileModule(
  await readFile("supabase/functions/_shared/billing-core.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { entitlement, validPlan, verifySignature, checkoutReturnPath } =
  await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
const config = {
  growth: "plan_growth",
  pro: "plan_pro",
  growthAmount: 57000,
  proAmount: 165300,
  currency: "PHP",
  live: false,
};
const future = Math.floor(Date.now() / 1000) + 86400;
const plan = {
  id: config.growth,
  amount: 57000,
  currency: "PHP",
  interval: "month",
  interval_count: 1,
};
const subscription = {
  id: "subs_one",
  attributes: {
    livemode: false,
    status: "active",
    plan,
    latest_invoice: { amount: 57000, currency: "PHP", status: "paid" },
    next_billing_schedule: new Date(future * 1000).toISOString(),
  },
};
assert(validPlan(plan, "growth", config));
assert(!validPlan({ ...plan, amount: 1000 }, "growth", config));
assert.equal(entitlement([subscription], config).plan, "growth");
for (const patch of [
  { status: "incomplete" },
  { status: "past_due" },
  { livemode: true },
  { latest_invoice: { status: "open" } },
  { latest_invoice: { amount: 1000, currency: "PHP", status: "paid" } },
  { next_billing_schedule: "invalid" },
])
  assert.equal(
    entitlement(
      [
        {
          ...subscription,
          attributes: { ...subscription.attributes, ...patch },
        },
      ],
      config,
    ).plan,
    "free",
  );
assert.equal(
  entitlement([subscription], config, (future + 1) * 1000).plan,
  "free",
);
assert.equal(checkoutReturnPath("https://evil.example"), "/upgrade");
assert.equal(
  checkoutReturnPath("/start-plan?cancelled=1"),
  "/start-plan?cancelled=1",
);
const payload = '{"data":{"id":"evt_one"}}',
  secret = "test-webhook-secret",
  timestamp = Math.floor(Date.now() / 1000);
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const signature = Buffer.from(
  await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  ),
).toString("hex");
await verifySignature(payload, `t=${timestamp},te=${signature},li=`, secret);
await assert.rejects(
  verifySignature(payload + " ", `t=${timestamp},te=${signature}`, secret),
);
await assert.rejects(
  verifySignature(payload, `t=${timestamp},te=${signature}`, secret, true),
);
await assert.rejects(
  verifySignature(
    payload,
    `t=${timestamp},te=${signature}`,
    secret,
    false,
    (timestamp + 301) * 1000,
  ),
);
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`,
);
for (const file of [
  "202610080001_review_link_management.sql",
  "202610080002_onboarding_publication.sql",
  "202610080003_onboarding_templates_assets.sql",
  "202610090004_plan_access.sql",
  "202610090005_stripe_billing.sql",
  "202610110032_paymongo_billing.sql",
])
  await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
const user = "00000000-0000-4000-8000-000000000001";
await db.query("insert into auth.users values($1)", [user]);
await db.exec("set role authenticated");
await assert.rejects(db.query("select * from public.billing_customers"));
await assert.rejects(db.query("select public.billing_claim($1,null)", [user]));
await db.exec("reset role");
await db.query(
  "insert into public.billing_customers(user_id,paymongo_customer_id) values($1,$2)",
  [user, "cus_test"],
);
await db.exec("set role service_role");
const rpc = async (name, args) =>
  (
    await db.query(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
      args,
    )
  ).rows[0].result;
const lease = await rpc("billing_claim", [user, "evt_one"]);
assert(lease.token);
assert((await rpc("billing_claim", [user, "evt_one"])).busy);
await assert.rejects(
  rpc("billing_apply", [
    user,
    crypto.randomUUID(),
    "evt_one",
    "pro",
    "sub_one",
    "active",
    new Date(future * 1000).toISOString(),
    false,
  ]),
);
await assert.rejects(
  rpc("billing_apply", [
    user,
    lease.token,
    "evt_one",
    "growth",
    "sub_one",
    "active",
    null,
    false,
  ]),
);
await rpc("billing_apply", [
  user,
  lease.token,
  "evt_one",
  "growth",
  "sub_one",
  "active",
  new Date(future * 1000).toISOString(),
  true,
]);
assert.equal(
  (await db.query("select plan from public.account_plans")).rows[0].plan,
  "growth",
);
assert((await rpc("billing_claim", [user, "evt_one"])).processed);
const next = await rpc("billing_claim", [user, "evt_two"]);
await rpc("billing_apply", [
  user,
  next.token,
  "evt_two",
  "free",
  null,
  "inactive",
  null,
  false,
]);
assert.equal(
  (await db.query("select plan from public.account_plans")).rows[0].plan,
  "free",
);
const expired = await rpc("billing_claim", [user, "evt_three"]);
await db.query(
  "update public.billing_customers set lease_until=now()-interval '1 second'",
);
const recovered = await rpc("billing_claim", [user, "evt_three"]);
assert.notEqual(expired.token, recovered.token);
await assert.rejects(
  rpc("billing_apply", [
    user,
    expired.token,
    "evt_three",
    "growth",
    "sub_one",
    "active",
    new Date(future * 1000).toISOString(),
    false,
  ]),
);
await rpc("billing_release", [user, recovered.token, "cs_test", "pro"]);
assert.equal(
  (await db.query("select checkout_session_id from public.billing_customers"))
    .rows[0].checkout_session_id,
  "cs_test",
);
const day = new Date().toISOString().slice(0, 10);
const quoteArgs = [day, false, "growth", 1000, 57000, 57];
const q1 = await rpc("billing_quote_claim", quoteArgs);
assert(q1.token);
assert((await rpc("billing_quote_claim", quoteArgs)).busy);
await db.query(
  "update public.billing_quotes set provider_plan_id='plan_test',lease_token=null,lease_until=null where day=$1 and livemode=false",
  [day],
);
assert.equal(
  (await rpc("billing_quote_claim", quoteArgs)).provider_plan_id,
  "plan_test",
);
assert(
  (await rpc("billing_quote_claim", [day, true, "growth", 1000, 57000, 57]))
    .token,
  "live quote must not reuse test plan",
);
await db.exec("reset role; set role authenticated");
await assert.rejects(db.query("select * from public.billing_quotes"));
await assert.rejects(
  db.query(
    "select public.billing_quote_claim($1,false,'growth',1000,57000,57)",
    [day],
  ),
);
await db.exec("reset role");
await db.close();
console.log(
  "Billing tests passed: monthly pricing, signed raw-body verification, subscription lifecycle, server permissions, leases, atomic entitlements, duplicate events.",
);

assert.equal(
  checkoutReturnPath("/upgrade?feature=analytics"),
  "/upgrade?feature=analytics",
);
assert.equal(
  checkoutReturnPath("/settings?tab=billing&checkout=success"),
  "/settings?tab=billing",
);
for (const unsafe of [
  "https://attacker.example",
  "//attacker.example",
  "/\\attacker.example",
  "/auth/callback",
  null,
])
  assert.equal(checkoutReturnPath(unsafe), "/upgrade");
