import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const uri = (source) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2023,
      },
    }).outputText,
  ).toString("base64");
const helper = uri(
  await readFile("supabase/functions/_shared/tracking.ts", "utf8"),
);
const linkId = "00000000-0000-4000-8000-000000000002";
const cardId = "00000000-0000-4000-8000-000000000001";
const visitorId = crypto.randomUUID();
let published = true,
  failure = null,
  handler,
  limited = false,
  lookups = 0;
const writes = [];
const secret = "test-signing-secret-32-characters-long";
globalThis.Deno = {
  env: {
    get: (name) => (name === "TRACKING_SIGNING_SECRET" ? secret : "fixture"),
  },
  serve: (value) => (handler = value),
};
globalThis.__createClient = () => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: { business_id: "business-fixture" },
          error: null,
        }),
      }),
    }),
  }),
  rpc: async (name, params) => {
    if (name === "allow_tracking_request")
      return { data: !limited, error: null };
    if (name === "published_review_card") {
      lookups++;
      return {
        data: published ? { id: cardId, destinations: [{ id: linkId }] } : null,
        error: null,
      };
    }
    writes.push(params);
    return { error: failure };
  },
});
const source = (
  await readFile("supabase/functions/review-events/index.ts", "utf8")
)
  .replace(
    /import \{ createClient \} from .*?;/,
    "const createClient = globalThis.__createClient;",
  )
  .replace('"../_shared/tracking.ts"', JSON.stringify(helper));
await import(uri(source));
const send = (data, address = "203.0.113.10") =>
  handler(
    new Request("https://fixture/review-events", {
      method: "POST",
      headers: { "x-forwarded-for": address },
      body: JSON.stringify(data),
    }),
  );
const session = await send({ action: "session", slug: "real-card", visitorId });
assert.equal(session.status, 200);
const { token } = await session.json();
const valid = {
  id: crypto.randomUUID(),
  slug: "real-card",
  type: "outbound_click",
  linkId,
  visitorId,
  token,
  cardId: "forged",
  referrer: "https://example.com/private?token=secret",
};
assert.equal((await send(valid)).status, 200);
assert.equal(writes[0].p_card_id, cardId);
assert.equal(writes[0].p_referrer, "example.com");
assert.equal(
  (await send({ ...valid, linkId: crypto.randomUUID() })).status,
  404,
);
assert.equal(writes.length, 1);
assert.equal((await send({ ...valid, type: "invalid" })).status, 400);
assert.equal((await send({ ...valid, token: token + "tampered" })).status, 403);
assert.equal(
  (await send({ ...valid, visitorId: crypto.randomUUID() })).status,
  403,
);
assert.equal((await send(valid, "203.0.113.11")).status, 403);
const before = lookups;
limited = true;
assert.equal((await send(valid)).status, 429);
assert.equal(lookups, before, "Limiter rejects before card lookup");
limited = false;
published = false;
assert.equal((await send(valid)).status, 404);
published = true;
assert.equal((await send({ ...valid, type: "page_view" })).status, 200);
assert.equal(writes.at(-1).p_link_id, null);
failure = { message: "Event rate limit exceeded" };
assert.equal((await send(valid)).status, 429);
failure = null;
const visitor = writes[0].p_visitor_key;
assert.match(visitor, /^[0-9a-f]{64}$/);
await send({ ...valid, id: crypto.randomUUID(), source: "qr" });
assert.equal(writes.at(-1).p_visitor_key, visitor);
assert.equal(writes.at(-1).p_source, "qr");
assert.equal(
  (await handler(new Request("https://fixture", { method: "OPTIONS" }))).status,
  200,
);
assert.equal(
  (
    await handler(
      new Request("https://fixture", {
        method: "POST",
        body: "x".repeat(5000),
      }),
    )
  ).status,
  413,
);
console.log(
  "PASS: signed tracking sessions, token/visitor/source binding, early rate limits, bounded bodies, publication validation, visitor hashing and attribution.",
);

// Exercise live refresh and cleanup without opening network connections.
let cleanup,
  subscribed,
  removed = false;
const bindings = [],
  invalidations = [],
  listeners = new Map();
const state = {
  business: { id: "business" },
  cards: Array.from({ length: 101 }, (_, i) => ({ id: `card-${i}` })),
};
const channel = {
  on: (_event, filter, callback) => {
    bindings.push({ filter, callback });
    return channel;
  },
  subscribe: (callback) => {
    subscribed = callback;
    return channel;
  },
};
globalThis.document = {
  visibilityState: "visible",
  addEventListener: (name, callback) => listeners.set(name, callback),
  removeEventListener: (name) => listeners.delete(name),
};
globalThis.__live = {
  useEffect: (callback) => (cleanup = callback()),
  useQueryClient: () => ({
    invalidateQueries: (args) => invalidations.push(args),
  }),
  useWorkspace: (selector) => selector(state),
  supabase: {
    channel: () => channel,
    removeChannel: () => {
      removed = true;
    },
  },
};
const liveSource =
  (await readFile("src/hooks/useLiveWorkspace.ts", "utf8")).replace(
    /^import .*;\n/gm,
    "",
  ) + "";
const liveCode =
  "const {useEffect,useQueryClient,useWorkspace,supabase} = globalThis.__live;\n" +
  liveSource;
const { useLiveWorkspace: runLiveWorkspace } = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      ts.transpileModule(liveCode, {
        compilerOptions: { module: ts.ModuleKind.ESNext },
      }).outputText,
    ).toString("base64")
);
runLiveWorkspace("user", "business");
assert.equal(bindings.length, 3);
assert(
  bindings.every((binding) => binding.filter.table !== "review_card_events"),
);
subscribed("SUBSCRIBED");
bindings[0].callback();
bindings[1].callback();
await new Promise((resolve) => setTimeout(resolve, 1100));
assert.deepEqual(invalidations, [
  { queryKey: ["workspace", "user", "business"] },
  { queryKey: ["card-performance", "user"] },
  { queryKey: ["overview-summary", "user"] },
  { queryKey: ["analytics-summary", "user"] },
  { queryKey: ["analytics-business-comparison", "user"] },
]);
bindings[0].callback();
cleanup();
await new Promise((resolve) => setTimeout(resolve, 1100));
assert.equal(invalidations.length, 5);
assert.equal(removed, true);
assert.equal(listeners.size, 0);
console.log(
  "PASS: live workspace changes refresh only the selected workspace, batch bursts, support 100+ cards, and clean up subscriptions.",
);
