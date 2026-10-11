import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
let handler,
  reserveError = null,
  sends = 0,
  lastActor,
  boundUser,
  lastScope,
  lastRPC,
  resendRecipient = null;
const db = {
  auth: {
    signInWithOtp: async (args) => {
      assert.equal(args.options.shouldCreateUser, false);
      sends++;
      return { error: null };
    },
    getUser: async (token) =>
      token === "owner-token"
        ? { data: { user: { id: "verified-owner" } }, error: null }
        : { data: {}, error: new Error("Invalid token") },
    admin: {
      updateUserById: async () => ({ error: null }),
      inviteUserByEmail: async () => {
        sends++;
        return { data: { user: { id: "new-invited-user" } }, error: null };
      },
    },
  },
  rpc: async (_name, args) => {
    lastRPC = _name;
    lastScope = args.p_all_businesses;
    lastActor = args.p_actor;
    return { data: "invitation-id", error: reserveError };
  },
  from: () => ({
    select: () => {
      const chain = {
        eq: () => chain,
        single: async () => ({
          data: { invited_user_id: resendRecipient },
          error: null,
        }),
      };
      return chain;
    },
    update: (values) => {
      boundUser = values.invited_user_id;
      const chain = {
        eq: () => chain,
        then: (resolve) => resolve({ error: null }),
      };
      return chain;
    },
  }),
};
const env = {
  APP_URL: "https://app.example.com",
  SUPABASE_URL: "https://db.example.com",
  SUPABASE_SERVICE_ROLE_KEY: "fixture",
};
globalThis.Deno = {
  env: { get: (key) => env[key] },
  serve: (fn) => {
    handler = fn;
  },
};
globalThis.fixtureCreateClient = () => db;
const tracking =
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpileModule(
      await readFile("supabase/functions/_shared/tracking.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2023,
        },
      },
    ).outputText,
  ).toString("base64");
const source = (
  await readFile("supabase/functions/workspace-invite/index.ts", "utf8")
).replace(
  /import \{ createClient \} from .*?;\n/,
  "const createClient = globalThis.fixtureCreateClient;\n",
);
await import(
  "data:text/javascript;base64," +
    Buffer.from(
      ts.transpileModule(
        source.replace('"../_shared/tracking.ts"', JSON.stringify(tracking)),
        { compilerOptions: { module: ts.ModuleKind.ESNext } },
      ).outputText,
    ).toString("base64")
);
function request(token = "owner-token", origin = env.APP_URL, extra = {}) {
  return new Request("https://db.example.com/functions/v1/workspace-invite", {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_id: "business-id",
      email: "new@example.com",
      role: "editor",
      ...extra,
    }),
  });
}
assert.equal((await handler(request("invalid"))).status, 401);
assert.equal(
  (await handler(request("owner-token", "https://attacker.example"))).status,
  403,
);
assert.equal(
  (await handler(request("owner-token", env.APP_URL, { role: "owner" })))
    .status,
  400,
);
assert.equal(sends, 0);
reserveError = { message: "This email already has an account" };
assert.equal((await handler(request())).status, 400);
assert.equal(
  sends,
  0,
  "Existing accounts must not trigger an invitation email",
);
reserveError = { message: "Member limit reached" };
assert.equal((await handler(request())).status, 400);
assert.equal(sends, 0);
reserveError = null;
assert.equal(
  (
    await handler(
      request("owner-token", env.APP_URL, {
        p_actor: "attacker",
        user_id: "attacker",
      }),
    )
  ).status,
  200,
);
assert.equal(lastActor, "verified-owner", "Never trust client-supplied actor");
assert.equal(sends, 1);
assert.equal(boundUser, "new-invited-user");
assert.equal(lastRPC, "reserve_scoped_workspace_invitation");
assert.equal(lastScope, false);
assert.equal(
  (
    await handler(
      request("owner-token", env.APP_URL, { all_businesses: "true" }),
    )
  ).status,
  400,
);
assert.equal(
  (await handler(request("owner-token", env.APP_URL, { all_businesses: true })))
    .status,
  200,
);
assert.equal(lastScope, true);
resendRecipient = "unfinished-user";
const resent = await handler(request());
assert.equal(resent.status, 200);
assert.equal((await resent.json()).resent, true);
console.log(
  "Invitation handler tests passed: authenticated owner identity, origin, roles, duplicate-email/seat failure without email, and bound invited user.",
);
