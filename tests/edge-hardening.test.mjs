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
const trackingURI = uri(
  await readFile("supabase/functions/_shared/tracking.ts", "utf8"),
);
const imageURI = uri(
  await readFile("supabase/functions/_shared/image-validation.ts", "utf8"),
);
const { signSession, verifySession, boundedBody } = await import(trackingURI);
const { validateImageBytes } = await import(imageURI);
const secret = "a-long-dedicated-signing-secret-for-tests";
const session = {
  slug: "test-card",
  card: crypto.randomUUID(),
  visitor: crypto.randomUUID(),
  source: "a".repeat(64),
  session: crypto.randomUUID(),
  expires: Date.now() + 60000,
};
assert.deepEqual(
  await verifySession(await signSession(session, secret), secret),
  session,
);
await assert.rejects(
  verifySession(
    await signSession({ ...session, expires: Date.now() - 1 }, secret),
    secret,
  ),
  /Expired/,
);
await assert.rejects(
  verifySession(await signSession(session, secret), "different-secret"),
  /Invalid/,
);
await assert.rejects(
  boundedBody(
    new Request("https://fixture", { method: "POST", body: "x".repeat(20) }),
    10,
  ),
  /too large/,
);
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZAAAAABJRU5ErkJggg==",
    "base64",
  ),
);
validateImageBytes(png, "image/png");
assert.throws(
  () => validateImageBytes(new Uint8Array(524289), "image/png"),
  /512 KB/,
);
assert.throws(
  () => validateImageBytes(new Uint8Array([1, 2, 3]), "image/png"),
  /Invalid/,
);
const huge = png.slice();
new DataView(huge.buffer).setUint32(16, 100000);
assert.throws(() => validateImageBytes(huge, "image/png"), /dimensions/);
assert.throws(() => validateImageBytes(png, "image/jpeg"), /JPEG/);
assert.throws(
  () => validateImageBytes(png.slice(0, -1), "image/png"),
  /Incomplete/,
);
let handler,
  reservationError = null,
  uploads = 0,
  lastReservation,
  cleaned = 0,
  claims = 0;
const env = {
  APP_URL: "https://app.example.com",
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fixture",
  ASSET_CLEANUP_SECRET: "cleanup-secret-longer-than-32-characters",
};
const db = {
  auth: {
    getUser: async (token) => ({
      data: {
        user: token === "verified-token" ? { id: "verified-user" } : null,
      },
      error: null,
    }),
  },
  rpc: async (name, args) => {
    if (name === "reserve_image_upload") {
      lastReservation = args;
      return { data: "verified-user/image.png", error: reservationError };
    }
    if (name === "claim_unused_assets") {
      claims++;
      return {
        data: [
          {
            id: "unused",
            bucket: "profile-assets",
            name: "verified-user/unused.png",
          },
        ],
        error: null,
      };
    }
    if (name === "finish_asset_cleanup") cleaned++;
    return { data: null, error: null };
  },
  storage: {
    from: () => ({
      upload: async () => {
        uploads++;
        return { error: null };
      },
      remove: async () => ({ error: null }),
      getPublicUrl: () => ({
        data: { publicUrl: "https://fixture/image.png" },
      }),
    }),
  },
};
globalThis.Deno = {
  env: { get: (key) => env[key] },
  serve: (fn) => (handler = fn),
};
globalThis.__imageDB = () => db;
const compileHandler = async (path) => {
  const source = (await readFile(path, "utf8"))
    .replace(
      /import \{ createClient \} from .*?;/,
      "const createClient = globalThis.__imageDB;",
    )
    .replace('"../_shared/tracking.ts"', JSON.stringify(trackingURI))
    .replace('"../_shared/image-validation.ts"', JSON.stringify(imageURI));
  await import(uri(source));
};
await compileHandler("supabase/functions/image-upload/index.ts");
const preflight = await handler(
  new Request("https://fixture/image-upload", {
    method: "OPTIONS",
    headers: {
      origin: env.APP_URL,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers":
        "content-type,x-image-bucket,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version",
    },
  }),
);
assert.equal(preflight.status, 204);
for (const header of [
  "x-image-bucket",
  "x-business-id",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
])
  assert(
    preflight.headers
      .get("Access-Control-Allow-Headers")
      .split(",")
      .map((v) => v.trim())
      .includes(header),
  );
const upload = (token = "verified-token", body = png, origin = env.APP_URL) =>
  handler(
    new Request("https://fixture/image-upload", {
      method: "POST",
      headers: {
        origin,
        authorization: `Bearer ${token}`,
        "content-type": "image/png",
        "x-image-bucket": "profile-assets",
      },
      body,
    }),
  );
assert.equal((await upload()).status, 200);
assert.equal(lastReservation.p_actor, "verified-user");
assert.equal(lastReservation.p_bytes, png.length);
assert.equal(uploads, 1);
assert.equal((await upload("forged-token")).status, 401);
assert.equal(
  (await upload("verified-token", png, "https://attacker.example")).status,
  403,
);
assert.equal(
  (await upload("verified-token", new Uint8Array(524289))).status,
  413,
);
reservationError = { message: "Upload rate limit exceeded" };
assert.equal((await upload()).status, 429);
assert.equal(uploads, 1, "Failed reservation cannot upload");
await compileHandler("supabase/functions/asset-cleanup/index.ts");
assert.equal(
  (await handler(new Request("https://fixture/cleanup", { method: "POST" })))
    .status,
  401,
);
assert.equal(claims, 0);
assert.equal(
  (
    await handler(
      new Request("https://fixture/cleanup", {
        method: "POST",
        headers: { authorization: `Bearer ${env.ASSET_CLEANUP_SECRET}` },
      }),
    )
  ).status,
  200,
);
assert.equal(cleaned, 1);
console.log(
  "PASS: expired/tampered tokens, bounded streams, image signatures/dimensions/size, authenticated quota reservation and secret-protected cleanup.",
);
