import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const linkId = "00000000-0000-4000-8000-000000000002";
const cardId = "00000000-0000-4000-8000-000000000001";
let published = true,
  failure = null,
  handler;
const writes = [];
globalThis.Deno = {
  env: { get: () => "fixture" },
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
    if (name === "published_review_card")
      return {
        data: published ? { id: cardId, destinations: [{ id: linkId }] } : null,
        error: null,
      };
    writes.push(params);
    return { error: failure };
  },
});
const source = (
  await readFile("supabase/functions/review-events/index.ts", "utf8")
).replace(
  /import \{ createClient \} from .*?;/,
  "const createClient = globalThis.__createClient;",
);
await import(
  "data:text/javascript;base64," +
    Buffer.from(
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext },
      }).outputText,
    ).toString("base64")
);
const send = (data) =>
  handler(
    new Request("https://fixture/review-events", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  );
const valid = {
  id: crypto.randomUUID(),
  slug: "real-card",
  type: "outbound_click",
  linkId,
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
published = false;
assert.equal((await send(valid)).status, 404);
published = true;
assert.equal((await send({ ...valid, type: "page_view" })).status, 200);
assert.equal(writes.at(-1).p_link_id, null);
failure = { message: "Event rate limit exceeded" };
assert.equal((await send(valid)).status, 429);
assert.equal(
  (await handler(new Request("https://fixture", { method: "OPTIONS" }))).status,
  200,
);
console.log(
  "PASS: public event tracking validates published cards and destinations, rejects forged IDs, sanitizes referrers, and honors rate limits.",
);

published = true;
failure = null;
const visitorId = crypto.randomUUID();
await send({ ...valid, visitorId });
const firstVisitor = writes.at(-1).p_visitor_key;
assert.match(firstVisitor, /^[0-9a-f]{64}$/);
assert.notEqual(firstVisitor, visitorId);
await send({ ...valid, id: crypto.randomUUID(), visitorId, source: "qr" });
assert.equal(writes.at(-1).p_visitor_key, firstVisitor);
assert.equal(writes.at(-1).p_source, "qr");
console.log(
  "PASS: visitor IDs are hashed consistently per business and campaign sources are captured.",
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
assert.equal(bindings.length, 2);
subscribed("SUBSCRIBED");
bindings[0].callback();
bindings[1].callback();
await new Promise((resolve) => setTimeout(resolve, 300));
assert.deepEqual(invalidations, [
  { queryKey: ["workspace", "user", "business"] },
]);
bindings[0].callback();
cleanup();
await new Promise((resolve) => setTimeout(resolve, 300));
assert.equal(invalidations.length, 1);
assert.equal(removed, true);
assert.equal(listeners.size, 0);
console.log(
  "PASS: live workspace changes refresh only the selected workspace, batch bursts, support 100+ cards, and clean up subscriptions.",
);
