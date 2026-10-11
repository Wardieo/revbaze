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
const { validPrice, entitlement, verifySignature, checkoutReturnPath } =
  await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
const config = { growth: "prod_growth", pro: "prod_pro" };
const price = {
  id: "price_growth",
  product: "prod_growth",
  active: true,
  currency: "usd",
  unit_amount: 1000,
  recurring: { interval: "month", interval_count: 1 },
};
const future = Math.floor(Date.now() / 1000) + 86400;
const subscription = {
  latest_invoice: { status: "paid" },
  id: "sub_one",
  status: "active",
  cancel_at_period_end: false,
  items: { data: [{ quantity: 1, current_period_end: future, price }] },
};
assert(validPrice(price, "growth", config.growth));
assert(!validPrice({ ...price, unit_amount: 999 }, "growth", config.growth));
assert(
  !validPrice(
    { ...price, recurring: { interval: "year", interval_count: 1 } },
    "growth",
    config.growth,
  ),
);
assert(!validPrice({ ...price, currency: "eur" }, "growth", config.growth));
assert.equal(entitlement([subscription], config).plan, "growth");
const trial = { ...subscription, status: "trialing", latest_invoice: null };
assert.equal(
  entitlement([trial], config).plan,
  "growth",
  "Verified trials grant access before the first charge",
);
assert.equal(
  entitlement([trial], config, (future + 1) * 1000).plan,
  "free",
  "Expired trials do not grant access",
);
assert.equal(
  checkoutReturnPath("/start-plan?cancelled=1"),
  "/start-plan?cancelled=1",
);
assert.equal(
  entitlement([{ ...subscription, latest_invoice: { status: "open" } }], config)
    .plan,
  "free",
);
assert.equal(
  entitlement([{ ...subscription, latest_invoice: null }], config).plan,
  "free",
);
assert.equal(
  entitlement([{ ...subscription, status: "past_due" }], config).plan,
  "free",
);
assert.equal(
  entitlement([{ ...subscription, status: "canceled" }], config).plan,
  "free",
);
assert.equal(
  entitlement([{ ...subscription, cancel_at_period_end: true }], config).plan,
  "growth",
);
assert.equal(
  entitlement([subscription], config, (future + 1) * 1000).plan,
  "free",
);
assert.equal(
  entitlement(
    [
      {
        ...subscription,
        items: { data: [{ quantity: 2, current_period_end: future, price }] },
      },
    ],
    config,
  ).plan,
  "free",
);
assert.equal(
  entitlement(
    [
      {
        ...subscription,
        items: {
          data: [
            {
              quantity: 1,
              current_period_end: future,
              price: { ...price, product: "prod_pro", unit_amount: 2900 },
            },
          ],
        },
      },
    ],
    config,
  ).plan,
  "pro",
);
const secret = "webhook-test-secret";
const payload = JSON.stringify({ id: "evt_test" });
const timestamp = Math.floor(Date.now() / 1000);
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
await verifySignature(payload, `t=${timestamp},v1=${signature}`, secret);
await verifySignature(
  payload,
  `t=${timestamp},v1=${"0".repeat(64)},v1=${signature}`,
  secret,
);
await assert.rejects(
  verifySignature(payload + " ", `t=${timestamp},v1=${signature}`, secret),
);
await assert.rejects(
  verifySignature(
    payload,
    `t=${timestamp},v1=${signature}`,
    secret,
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
  "202610110033_restore_stripe_billing.sql",
]) {
  if (file === "202610110033_restore_stripe_billing.sql") {
    await db.exec(`insert into auth.users values ('00000000-0000-4000-8000-000000000099');
      insert into public.billing_customers(user_id,legacy_customer_id,paymongo_customer_id,subscription_id,checkout_session_id)
      values ('00000000-0000-4000-8000-000000000099','cus_old_stripe','cus_old_paymongo','sub_paymongo','pi_paymongo');
      insert into public.account_plans(user_id,plan,expires_at) values ('00000000-0000-4000-8000-000000000099','growth',now()+interval '1 day');`);
  }
  await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
}
const restored = (await db.query("select * from public.billing_customers"))
  .rows[0];
assert.equal(restored.stripe_customer_id, "cus_old_stripe");
assert.equal(restored.subscription_id, null);
assert.equal(restored.checkout_session_id, null);
assert.equal(
  (await db.query("select plan from public.account_plans")).rows[0].plan,
  "growth",
);
assert.equal(
  (await db.query("select billing_state from public.legacy_paymongo_billing"))
    .rows[0].billing_state.subscription_id,
  "sub_paymongo",
);
await db.exec(
  "delete from auth.users where id='00000000-0000-4000-8000-000000000099'",
);
const user = "00000000-0000-4000-8000-000000000001";
await db.query("insert into auth.users values($1)", [user]);
await db.exec("set role authenticated");
await assert.rejects(db.query("select * from public.billing_customers"));
await assert.rejects(db.query("select public.billing_claim($1,null)", [user]));
await db.exec("reset role");
await db.query(
  "insert into public.billing_customers(user_id,stripe_customer_id) values($1,$2)",
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
