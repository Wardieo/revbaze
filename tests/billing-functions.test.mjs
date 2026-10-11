import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
// Type-check the deployable functions; browser builds intentionally exclude Deno code.
const options = {
  noEmit: true,
  strict: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
};
const virtualFile =
  process.cwd() + "/supabase/functions/__deno_test_types.d.ts";
const host = ts.createCompilerHost(options);
const originalGetSource = host.getSourceFile.bind(host);
host.getSourceFile = (file, ...args) =>
  file === virtualFile
    ? ts.createSourceFile(
        file,
        "declare const Deno: {env: {get(name:string):string|undefined}; serve(handler:(request:Request)=>Promise<Response>):void};",
        ts.ScriptTarget.ES2022,
      )
    : originalGetSource(file, ...args);
host.resolveModuleNames = (names, file) =>
  names.map(
    (name) =>
      ts.resolveModuleName(
        name.startsWith("npm:") ? "@supabase/supabase-js" : name,
        file,
        options,
        host,
      ).resolvedModule,
  );
const program = ts.createProgram(
  [
    "supabase/functions/billing/index.ts",
    "supabase/functions/review-events/index.ts",
    "supabase/functions/stripe-webhook/index.ts",
    "supabase/functions/image-upload/index.ts",
    "supabase/functions/asset-cleanup/index.ts",
    virtualFile,
  ],
  options,
  host,
);
assert.deepEqual(
  ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")),
  [],
);
const compile = (s) =>
  ts.transpileModule(s, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const uri = (s) =>
  "data:text/javascript;base64," + Buffer.from(compile(s)).toString("base64");
const tracking = uri(
  await readFile("supabase/functions/_shared/tracking.ts", "utf8"),
);
const core = uri(
  await readFile("supabase/functions/_shared/billing-core.ts", "utf8"),
);
const env = {
  APP_URL: "https://app.example.com",
  SUPABASE_URL: "https://db.example.com",
  SUPABASE_SERVICE_ROLE_KEY: "server-test",
  STRIPE_SECRET_KEY: "sk_test_local_fixture",
  STRIPE_WEBHOOK_SECRET: "local-webhook-secret",
  STRIPE_GROWTH_PRICE_ID: "prod_growth",
  STRIPE_PRO_PRICE_ID: "prod_pro",
};
let customer = null,
  checkout = null,
  lease = null,
  plan = "free",
  applied = 0,
  stripeCalls = 0,
  checkoutCreates = 0,
  active = [];
const user = { id: "owner-uuid", email: "owner@example.com" };
const query = () => {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: customer, error: null }),
    single: async () => ({ data: customer, error: null }),
    upsert: async (row) => {
      customer ??= row;
      return { error: null };
    },
  };
  return q;
};
globalThis.__createClient = () => ({
  auth: {
    getUser: async (token) =>
      token === "valid-token"
        ? { data: { user }, error: null }
        : { data: { user: null }, error: new Error("Invalid") },
  },
  from: query,
  rpc: async (name, args) => {
    if (name === "billing_claim") {
      lease = "00000000-0000-4000-8000-000000000001";
      return {
        data: {
          token: lease,
          checkout: checkout?.id,
          checkout_plan: checkout?.metadata?.revbaze_plan,
        },
      };
    }
    if (name === "billing_release") {
      lease = null;
      return { data: null, error: null };
    }
    if (name === "billing_apply") {
      assert.equal(args.p_token, lease);
      plan = args.p_plan;
      applied++;
      lease = null;
      return { error: null };
    }
    throw new Error("Unexpected RPC");
  },
});
globalThis.Deno = {
  env: { get: (n) => env[n] },
  serve: (handler) => {
    globalThis.__handler = handler;
  },
};
const runtime = uri(
  (await readFile("supabase/functions/_shared/billing-runtime.ts", "utf8"))
    .replace(
      /import \{ createClient \} from ['"]npm:@supabase\/supabase-js@2\.109\.0['"];/,
      "const createClient=globalThis.__createClient;",
    )
    .replace(/['"]\.\/billing-core\.ts['"]/, JSON.stringify(core)),
);
const handlers = async (path) => {
  const source = (await readFile(path, "utf8"))
    .replace(
      /['"]\.\.\/_shared\/billing-runtime\.ts['"]/,
      JSON.stringify(runtime),
    )
    .replace(/['"]\.\.\/_shared\/billing-core\.ts['"]/, JSON.stringify(core));
  await import(
    uri(
      source.replace(
        /['"]\.\.\/_shared\/tracking\.ts['"]/,
        JSON.stringify(tracking),
      ),
    )
  );
  return globalThis.__handler;
};
const billing = await handlers("supabase/functions/billing/index.ts");
const webhook = await handlers("supabase/functions/stripe-webhook/index.ts");
const price = {
  id: "price_growth",
  product: "prod_growth",
  active: true,
  currency: "usd",
  unit_amount: 1000,
  recurring: { interval: "month", interval_count: 1 },
};
globalThis.fetch = async (url, options) => {
  stripeCalls++;
  assert(url.startsWith("https://api.stripe.com/v1/"));
  assert.equal(options.headers.Authorization, "Bearer sk_test_local_fixture");
  const path = url.split("/v1/")[1];
  let value;
  if (path.startsWith("prices?"))
    value = {
      data: [
        path.includes("prod_pro")
          ? {
              ...price,
              id: "price_pro",
              product: "prod_pro",
              unit_amount: 2900,
            }
          : price,
      ],
      has_more: false,
    };
  else if (path === "billing_portal/configurations/bpc_test")
    value = {
      active: true,
      features: {
        subscription_update: {
          enabled: true,
          proration_behavior: "always_invoice",
        },
      },
    };
  else if (path.startsWith("billing_portal/configurations?"))
    value = {
      data: [
        {
          is_default: true,
          features: {
            subscription_update: { proration_behavior: "always_invoice" },
          },
        },
      ],
    };
  else if (path === "customers" || path === "customers/cus_fixture") {
    const body = new URLSearchParams(options.body);
    assert.equal(body.get("email"), user.email);
    value = { id: "cus_fixture", email: user.email };
  } else if (path.startsWith("subscriptions?"))
    value = { data: active, has_more: false };
  else if (path.startsWith("checkout/sessions?"))
    value = { data: checkout ? [checkout] : [], has_more: false };
  else if (path === "checkout/sessions") {
    checkoutCreates++;
    const body = new URLSearchParams(options.body);
    assert.equal(body.get("mode"), "subscription");
    assert.equal(body.get("ui_mode"), "hosted");
    assert.equal(body.get("payment_method_collection"), "always");
    assert.equal(body.get("subscription_data[trial_period_days]"), null);
    assert.equal(
      body.get(
        "subscription_data[trial_settings][end_behavior][missing_payment_method]",
      ),
      null,
    );
    assert.equal(body.get("metadata[revbaze_trial_days]"), "0");
    const target = body.get("metadata[revbaze_plan]");
    assert.equal(
      body.get("line_items[0][price]"),
      target === "pro" ? "price_pro" : "price_growth",
    );
    assert.equal(
      body.get("success_url"),
      `https://app.example.com/#/checkout?result=success&plan=${target}&returnTo=%2Fupgrade`,
    );
    checkout = {
      id: "cs_fixture",
      status: "open",
      success_url: body.get("success_url"),
      cancel_url: body.get("cancel_url"),
      url: "https://checkout.stripe.com/test",
      client_reference_id: user.id,
      metadata: {
        revbaze_plan: target,
        revbaze_trial_days: body.get("metadata[revbaze_trial_days]"),
      },
    };
    value = checkout;
  } else if (path === "checkout/sessions/cs_fixture") value = checkout;
  else if (path === "checkout/sessions/cs_fixture/expire") {
    checkout.status = "expired";
    value = checkout;
  } else if (path === "billing_portal/sessions") {
    const body = new URLSearchParams(options.body);
    if (env.STRIPE_PORTAL_CONFIGURATION_ID)
      assert.equal(
        body.get("configuration"),
        env.STRIPE_PORTAL_CONFIGURATION_ID,
      );
    if (body.has("flow_data[type]")) {
      assert.equal(body.get("flow_data[type]"), "subscription_update_confirm");
      assert.equal(
        body.get("flow_data[subscription_update_confirm][subscription]"),
        "sub_test",
      );
      assert.equal(
        body.get("flow_data[subscription_update_confirm][items][0][price]"),
        "price_pro",
      );
      assert.equal(
        body.get("flow_data[subscription_update_confirm][items][0][id]"),
        "si_test",
      );
    }
    value = { url: "https://billing.stripe.com/test" };
  } else throw new Error("Unexpected Stripe request " + path);
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
};
const request = (action, extra = {}) =>
  new Request("https://db.example.com/functions/v1/billing", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-token",
      Origin: env.APP_URL,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...extra }),
  });
let result = await billing(
  new Request("https://db.example.com/functions/v1/billing", {
    method: "POST",
    body: "{}",
  }),
);
assert.equal(result.status, 401);
assert.equal(stripeCalls, 0);
result = await billing(
  new Request("https://db.example.com/functions/v1/billing", {
    method: "POST",
    headers: { Origin: "https://attacker.example" },
    body: "{}",
  }),
);
assert.equal(result.status, 403);
result = await billing(request("checkout", { plan: "free" }));
assert.equal(result.status, 400);
assert.equal(stripeCalls, 0);
result = await billing(
  request("checkout", {
    plan: "growth",
    price: "attacker_price",
    user_id: "attacker",
    success_url: "https://attacker.example",
  }),
);
assert.equal(result.status, 200);
assert.equal((await result.json()).url, "https://checkout.stripe.com/test");
assert.equal(plan, "free");
result = await billing(request("checkout", { plan: "growth" }));
assert.equal(result.status, 200);
assert.equal(checkoutCreates, 1);
// Old trial checkout must be replaced before it can be reused.
checkout.metadata.revbaze_trial_days = "14";
result = await billing(request("checkout", { plan: "growth" }));
assert.equal(result.status, 200);
assert.equal(checkoutCreates, 2);
assert.equal(checkout.metadata.revbaze_trial_days, "0");
active = [
  {
    latest_invoice: { status: "paid" },
    id: "sub_test",
    status: "active",
    items: {
      data: [
        {
          id: "si_test",
          quantity: 1,
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
          price,
        },
      ],
    },
  },
];
result = await billing(request("checkout", { plan: "growth" }));
assert.equal((await result.json()).url, "https://billing.stripe.com/test");
assert.equal(checkoutCreates, 2);
result = await billing(request("checkout", { plan: "pro" }));
assert.equal(result.status, 200);
assert.equal((await result.json()).url, "https://billing.stripe.com/test");
assert.equal(checkoutCreates, 2);
assert.equal(plan, "free", "Opening payment confirmation cannot grant access");
env.STRIPE_PORTAL_CONFIGURATION_ID = "bpc_test";
result = await billing(request("checkout", { plan: "pro" }));
assert.equal(
  result.status,
  200,
  "An explicit non-default Revbaze configuration must allow the upgrade",
);
assert.equal((await result.json()).url, "https://billing.stripe.com/test");
const event = {
  id: "evt_test",
  livemode: false,
  type: "checkout.session.completed",
  data: {
    object: { customer: "cus_fixture", client_reference_id: "attacker" },
  },
};
const payload = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),
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
result = await webhook(
  new Request("https://db.example.com/functions/v1/stripe-webhook", {
    method: "POST",
    body: payload,
  }),
);
assert.equal(result.status, 400);
assert.equal(applied, 0);
result = await webhook(
  new Request("https://db.example.com/functions/v1/stripe-webhook", {
    method: "POST",
    headers: { "Stripe-Signature": `t=${timestamp},v1=${signature}` },
    body: payload,
  }),
);
assert.equal(result.status, 200);
assert.equal(plan, "growth");
assert.equal(applied, 1);
// Delayed checkout events reconcile today's cancelled state, never the event's old state.
active = [];
result = await webhook(
  new Request("https://db.example.com/functions/v1/stripe-webhook", {
    method: "POST",
    headers: { "Stripe-Signature": `t=${timestamp},v1=${signature}` },
    body: payload,
  }),
);
assert.equal(result.status, 200);
assert.equal(plan, "free");
// A Free account selecting Pro must get payment checkout, not a dashboard URL.
checkout = null;
result = await billing(request("checkout", { plan: "pro" }));
assert.equal(result.status, 200);
assert.equal((await result.json()).url, "https://checkout.stripe.com/test");
assert.equal(plan, "free");
assert.equal(checkout.metadata.revbaze_plan, "pro");
checkout.cancel_url = "https://app.example.com/#/upgrade?checkout=cancelled";
const beforeReplace = checkoutCreates;
result = await billing(request("checkout", { plan: "pro" }));
assert.equal(result.status, 200);
assert.equal(
  checkoutCreates,
  beforeReplace + 1,
  "A pending session with stale return URLs must be replaced",
);
assert(checkout.cancel_url.includes("/#/checkout?result=cancelled"));
active = [
  {
    id: "sub_pro",
    status: "active",
    latest_invoice: { status: "open" },
    items: {
      data: [
        {
          id: "si_pro",
          quantity: 1,
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
          price: {
            ...price,
            id: "price_pro",
            product: "prod_pro",
            unit_amount: 2900,
          },
        },
      ],
    },
  },
];
const deliver = () =>
  webhook(
    new Request("https://db.example.com/functions/v1/stripe-webhook", {
      method: "POST",
      headers: { "Stripe-Signature": `t=${timestamp},v1=${signature}` },
      body: payload,
    }),
  );
assert.equal((await deliver()).status, 200);
assert.equal(plan, "free", "Unpaid Pro invoice cannot unlock Pro");
active[0].latest_invoice.status = "paid";
assert.equal((await deliver()).status, 200);
assert.equal(plan, "pro");
console.log(
  "Billing handler tests passed: authentication, origin, server price selection, session reuse, duplicate-subscription prevention, portal, signed webhook, fresh reconciliation.",
);
