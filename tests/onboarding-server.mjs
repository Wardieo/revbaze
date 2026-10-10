// Local browser-test harness. Executes the real migrations/RPCs in isolated PostgreSQL.
// Never points at or changes a hosted Supabase project.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`,
);
for (const path of [
  "supabase/migrations/202610080001_review_link_management.sql",
  "supabase/migrations/202610080002_onboarding_publication.sql",
  "supabase/migrations/202610080003_onboarding_templates_assets.sql",
  "supabase/migrations/202610090004_plan_access.sql",
])
  await db.exec(await readFile(path, "utf8"));
const userId = "11111111-1111-4111-8111-111111111111";
await db.query("insert into auth.users values($1)", [userId]);
await db.query(
  "insert into public.account_plans(user_id,plan) values($1,'growth')",
  [userId],
);
const rpc = {
  account_plan_status: ["p_business_id"],
  onboarding_status: [],
  begin_onboarding: ["p_new_business"],
  save_onboarding_draft: ["p_id", "p_draft", "p_step", "p_revision"],
  check_onboarding_slug: ["p_slug", "p_card_id"],
  publish_onboarding: ["p_id", "p_revision"],
  published_review_card: ["p_slug"],
};
let queue = Promise.resolve(),
  failPublish = false;
createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  try {
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) : {};
    if (req.url === "/test-plan") {
      if (!["free", "growth", "pro"].includes(body.plan))
        throw new Error("Invalid test plan");
      const pending = queue.then(async () => {
        await db.exec("reset role");
        await db.query(
          "update public.account_plans set plan=$1 where user_id=$2",
          [body.plan, userId],
        );
      });
      queue = pending.catch(() => {});
      await pending;
      res.end("{}");
      return;
    }
    if (req.url === "/fail-publish") {
      failPublish = body.fail;
      res.end("{}");
      return;
    }
    const name = req.url.slice(1);
    if (!Object.hasOwn(rpc, name)) {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    const run = async () => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        req.headers["x-test-anon"] === "true" ? "" : userId,
      ]);
      await db.exec(
        req.headers["x-test-anon"] === "true"
          ? "set role anon"
          : "set role authenticated",
      );
      if (name === "publish_onboarding" && failPublish)
        throw new Error(
          "Connection interrupted during publication. Please retry.",
        );
      const keys = rpc[name];
      const values = keys.map((key) =>
        key === "p_draft" ? JSON.stringify(body[key]) : body[key],
      );
      const casts = keys.map(
        (key, i) => "$" + (i + 1) + (key === "p_draft" ? "::jsonb" : ""),
      );
      const result = await db.query(
        `select public.${name}(${casts.join(",")}) as result`,
        values,
      );
      return result.rows[0].result;
    };
    const pending = queue.then(run);
    queue = pending.catch(() => {});
    res.end(JSON.stringify(await pending));
  } catch (err) {
    res.statusCode = 400;
    res.end(JSON.stringify({ message: err.message }));
  }
}).listen(8181, "127.0.0.1", () =>
  console.log("Isolated PostgreSQL onboarding test server on 8181"),
);
