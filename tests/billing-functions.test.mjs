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
    "supabase/functions/billing-renewals/index.ts",
    "supabase/functions/review-events/index.ts",
    "supabase/functions/paymongo-webhook/index.ts",
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
const core = uri(
  await readFile("supabase/functions/_shared/billing-core.ts", "utf8"),
);
const tracking = uri(
  await readFile("supabase/functions/_shared/tracking.ts", "utf8"),
);
const env = {
  APP_URL: "https://app.example.com",
  SUPABASE_URL: "https://db.example.com",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  PAYMONGO_SECRET_KEY: "sk_test_fixture",
  PAYMONGO_PUBLIC_KEY: "pk_test_fixture",
  PAYMONGO_WEBHOOK_SECRET: "fixture-secret",
};
let prior = null;
let row = { user_id: "owner", paymongo_customer_id: "cus_owner" },
  lease = null,
  applied = 0,
  items = [],
  quote = null,
  apiCalls = 0;
const processed = new Set();
const db = {
  auth: {
    getUser: async (token) => ({
      data: {
        user:
          token === "valid"
            ? { id: "owner", email: "owner@example.com", user_metadata: {} }
            : null,
      },
    }),
  },
  from(table) {
    let changes,
      filters = {};
    const q = {
      select: () => q,
      eq: (k, v) => {
        filters[k] = v;
        return q;
      },
      update: (v) => {
        changes = v;
        return q;
      },
      upsert: () => q,
      single: async () => ({
        data:
          table === "billing_customers"
            ? row
            : table === "billing_fx_rates"
              ? { rate: 57, source_updated_at: new Date().toISOString() }
              : quote,
      }),
      maybeSingle: async () => ({
        data:
          table === "billing_customers"
            ? row
            : table === "billing_fx_rates"
              ? { rate: 57, source_updated_at: new Date().toISOString() }
              : table === "billing_quotes"
                ? quote
                : table === "account_plans"
                  ? prior
                  : null,
      }),
      then(resolve) {
        if (changes) Object.assign(row, changes);
        resolve({ data: null, error: null });
      },
    };
    return q;
  },
  rpc: async (name, args) => {
    if (name === "billing_claim") {
      if (processed.has(args.p_event)) return { data: { processed: true } };
      if (lease) return { data: { busy: true } };
      lease = "lease";
      return { data: { token: lease } };
    }
    if (name === "billing_release") {
      lease = null;
      return { data: null };
    }
    if (name === "billing_apply") {
      prior = { plan: args.p_plan, expires_at: args.p_period_end };
      applied++;
      processed.add(args.p_event);
      lease = null;
      return { data: null };
    }
    if (name === "billing_quote_claim") {
      assert.equal(args.p_php, 57000);
      assert.equal(args.p_usd, 1000);
      assert.equal(args.p_live, false);
    }
    if (name === "billing_quote_claim")
      return { data: { provider_plan_id: "plan_growth" } };
    throw new Error(name);
  },
};
globalThis.__billingdb = db;
let handler;
globalThis.Deno = {
  env: { get: (k) => env[k] },
  serve: (fn) => {
    handler = fn;
  },
};
const runtime = uri(
  (await readFile("supabase/functions/_shared/billing-runtime.ts", "utf8"))
    .replace(
      'import { createClient } from "npm:@supabase/supabase-js@2.109.0";',
      "const createClient=()=>globalThis.__billingdb;",
    )
    .replace('"./billing-core.ts"', JSON.stringify(core)),
);
async function load(file) {
  await import(
    uri(
      (await readFile(file, "utf8"))
        .replace('"../_shared/tracking.ts"', JSON.stringify(tracking))
        .replace('"../_shared/billing-core.ts"', JSON.stringify(core))
        .replace('"../_shared/billing-runtime.ts"', JSON.stringify(runtime)),
    )
  );
  return handler;
}
const billing = await load("supabase/functions/billing/index.ts"),
  webhook = await load("supabase/functions/paymongo-webhook/index.ts");
globalThis.fetch = async (url, options) => {
  apiCalls++;
  let data;
  if (url.includes("subscriptions?")) data = items;
  else if (url.endsWith("/subscriptions") && options.method === "POST")
    data = {
      id: "subs_one",
      attributes: {
        plan: { id: "plan_growth" },
        status: "incomplete",
        latest_invoice: { payment_intent: { id: "pi_one" } },
      },
    };
  else if (url.endsWith("/payment_intents/pi_one"))
    data = {
      id: "pi_one",
      attributes: {
        client_key: "pi_client",
        amount: 57000,
        currency: "PHP",
        payment_method_allowed: ["card", "paymaya"],
      },
    };
  else if (url.endsWith("/subscriptions/subs_one")) {
    if (options.method === "DELETE") items[0].attributes.status = "cancelled";
    data = items[0];
  } else throw new Error(url);
  return new Response(JSON.stringify({ data }), { status: 200 });
};
const request = (action, auth = "valid", origin = "https://app.example.com") =>
  new Request("https://db.example.com/functions/v1/billing", {
    method: "POST",
    headers: { authorization: `Bearer ${auth}`, origin },
    body: JSON.stringify({ action, plan: "growth" }),
  });
assert.equal((await billing(request("checkout", "invalid"))).status, 401);
assert.equal(apiCalls, 0);
assert.equal(
  (await billing(request("checkout", "valid", "https://evil.example"))).status,
  403,
);
assert.equal(apiCalls, 0);
let result = await billing(request("checkout"));
assert.equal(result.status, 200);
assert.equal((await result.json()).payment.amount, 57000);
assert.equal(row.subscription_id, "subs_one");
lease = "busy";
assert.equal((await billing(request("checkout"))).status, 409);
lease = null;
items = [
  {
    id: "subs_one",
    attributes: {
      status: "active",
      livemode: false,
      customer_id: "cus_owner",
      plan: {
        id: "plan_growth",
        amount: 57000,
        currency: "PHP",
        interval: "month",
        interval_count: 1,
      },
      latest_invoice: { status: "paid", amount: 57000, currency: "PHP" },
      next_billing_schedule: new Date(Date.now() + 86400000).toISOString(),
    },
  },
];
quote = {
  plan: "growth",
  usd_amount: 1000,
  php_amount: 57000,
  livemode: false,
};
result = await billing(request("status"));
assert.equal(result.status, 200);
assert.equal(applied, 1);
assert.equal(
  (
    await webhook(
      new Request("https://db.example.com/webhook", {
        method: "POST",
        body: "{}",
      }),
    )
  ).status,
  400,
);
const event = JSON.stringify({
  data: {
    id: "evt_one",
    attributes: {
      type: "subscription.invoice.paid",
      livemode: false,
      data: { attributes: { customer_id: "cus_owner" } },
    },
  },
});
const stamp = Math.floor(Date.now() / 1000);
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(env.PAYMONGO_WEBHOOK_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const sig = Buffer.from(
  await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${stamp}.${event}`),
  ),
).toString("hex");
const hook = () =>
  new Request("https://db.example.com/webhook", {
    method: "POST",
    headers: { "Paymongo-Signature": `t=${stamp},te=${sig},li=` },
    body: event,
  });
assert.equal((await webhook(hook())).status, 200);
const before = applied;
assert.equal((await webhook(hook())).status, 200);
assert.equal(applied, before);
console.log(
  "PASS: deployable function types, PayMongo authentication/origin checks, payment setup, leases, private quote validation, raw webhook signatures and replay protection.",
);

result = await billing(request("cancel"));
assert.equal(result.status, 200);
assert.equal(prior.plan, "growth", "cancellation preserves the paid period");
assert.equal((await billing(request("status"))).status, 200);
assert.equal(prior.plan, "growth");

const { billingErrorMessage } = await import(
  uri(await readFile("src/lib/billingErrors.ts", "utf8"))
);
assert.equal(
  await billingErrorMessage({
    context: new Response(JSON.stringify({ message: "Invalid JWT" }), {
      status: 401,
    }),
  }),
  "Invalid JWT",
);
assert.equal(
  await billingErrorMessage({
    context: new Response(
      JSON.stringify({
        error: "Billing setup is incomplete: PAYMONGO_SECRET_KEY",
      }),
      { status: 503 },
    ),
  }),
  "Billing setup is incomplete: PAYMONGO_SECRET_KEY",
);
assert.match(
  await billingErrorMessage({ context: new Response("", { status: 404 }) }),
  /not deployed/,
);
assert.match(
  await billingErrorMessage({ name: "FunctionsFetchError" }),
  /APP_URL/,
);
assert.match(
  await billingErrorMessage({
    context: new Response("Bad gateway", { status: 502 }),
  }),
  /HTTP 502/,
);
console.log(
  "PASS: checkout preserves function/gateway errors and identifies network/deployment failures.",
);

const preflight = await billing(
  new Request("https://db.example.com/functions/v1/billing", {
    method: "OPTIONS",
    headers: {
      origin: "https://preview.example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers":
        "authorization,apikey,content-type,x-client-info",
    },
  }),
);
assert.equal(preflight.status, 200);
assert.equal(
  preflight.headers.get("access-control-allow-origin"),
  "https://preview.example.com",
);
const rejected = await billing(
  request("checkout", "valid", "https://preview.example.com"),
);
assert.equal(rejected.status, 403);
assert.equal(
  rejected.headers.get("access-control-allow-origin"),
  "https://preview.example.com",
);
assert.match((await rejected.json()).error, /APP_URL/);
env.BILLING_ALLOWED_ORIGINS = "https://preview.example.com";
assert.equal(
  (await billing(request("status", "valid", "https://preview.example.com")))
    .status,
  200,
);
delete env.BILLING_ALLOWED_ORIGINS;
console.log(
  "PASS: preflight succeeds, unauthorized origins receive readable errors, and explicit extra origins are accepted.",
);

const originalFetch = globalThis.fetch,
  originalAuth = db.auth.getUser;
db.auth.getUser = async () => ({
  data: {
    user: {
      id: "owner",
      email: "owner@example.com",
      user_metadata: { name: "Edward Mosquera" },
    },
  },
});
row.paymongo_customer_id = null;
items = [];
globalThis.fetch = async (url, options) => {
  if (url.endsWith("/customers")) {
    const attrs = JSON.parse(options.body).data.attributes;
    assert.equal(attrs.first_name, "Edward");
    assert.equal(attrs.last_name, "Mosquera");
    assert.equal(attrs.default_device, "email");
    return new Response(JSON.stringify({ data: { id: "cus_owner" } }), {
      status: 200,
    });
  }
  return originalFetch(url, options);
};
assert.equal((await billing(request("checkout"))).status, 200);
// Signup permits a single name; PayMongo still requires a nonempty surname.
db.auth.getUser = async () => ({
  data: {
    user: {
      id: "owner",
      email: "owner@example.com",
      user_metadata: { name: "Edward" },
    },
  },
});
row.paymongo_customer_id = null;
items = [];
globalThis.fetch = async (url, options) => {
  if (url.endsWith("/customers")) {
    const attrs = JSON.parse(options.body).data.attributes;
    assert.equal(attrs.first_name, "Edward");
    assert.equal(attrs.last_name, "Customer");
    assert.equal(attrs.default_device, "email");
    return new Response(JSON.stringify({ data: { id: "cus_owner" } }), {
      status: 200,
    });
  }
  return originalFetch(url, options);
};
assert.equal((await billing(request("checkout"))).status, 200);
db.auth.getUser = originalAuth;
const runtimeExports = await import(runtime),
  oldRPC = db.rpc,
  oldFrom = db.from;
db.rpc = async (name, args) =>
  name === "billing_quote_claim"
    ? { data: { token: "quote-token", php_amount: 57000 } }
    : oldRPC(name, args);
db.from = (table) => {
  if (table !== "billing_quotes") return oldFrom(table);
  const q = {
    update: () => q,
    eq: () => q,
    select: () => q,
    single: async () => ({
      data: { provider_plan_id: "plan_generated" },
      error: null,
    }),
  };
  return q;
};
globalThis.fetch = async (url, options) => {
  assert(url.endsWith("/subscriptions/plans"));
  const attrs = JSON.parse(options.body).data.attributes;
  assert.equal(attrs.interval, "monthly");
  assert.equal(attrs.interval_count, 1);
  assert.equal(attrs.currency, "PHP");
  assert.equal(attrs.amount, 57000);
  return new Response(JSON.stringify({ data: { id: "plan_generated" } }), {
    status: 200,
  });
};
assert.equal(await runtimeExports.resolvePlan("growth"), "plan_generated");
db.rpc = oldRPC;
db.from = oldFrom;
const logs = [],
  originalConsole = console.error;
console.error = (...args) => logs.push(args);
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      errors: [
        {
          code: "invalid_request_body",
          source: { attribute: "last_name" },
          detail: "DO_NOT_LOG_CUSTOMER_VALUE",
        },
      ],
    }),
    { status: 400 },
  );
await assert.rejects(
  runtimeExports.paymongo("customers", {}),
  /POST customers.*last_name/,
);
assert(!JSON.stringify(logs).includes("DO_NOT_LOG_CUSTOMER_VALUE"));
assert(JSON.stringify(logs).includes("fields=last_name"));
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      errors: [
        {
          code: "merchant_invalid_state",
          detail:
            "no subscription payment methods are configured for this organization",
        },
      ],
    }),
    { status: 400 },
  );
await assert.rejects(
  runtimeExports.paymongo("subscriptions/plans", {}),
  /Ask PayMongo support to enable Subscriptions/,
);
console.error = originalConsole;
globalThis.fetch = originalFetch;
console.log(
  "PASS: customer first/last names, PayMongo monthly plan enum, and safe operation/field validation diagnostics.",
);
