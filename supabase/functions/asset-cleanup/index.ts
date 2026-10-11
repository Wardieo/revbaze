import { createClient } from "npm:@supabase/supabase-js@2.109.0";
Deno.serve(async (request: Request) => {
  const secret = Deno.env.get("ASSET_CLEANUP_SECRET");
  if (
    !secret ||
    secret.length < 32 ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  )
    return new Response(null, { status: 401 });
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const limits = await db.rpc("cleanup_request_limits");
  if (limits.error) return new Response(null, { status: 503 });
  const claimed = await db.rpc("claim_unused_assets", { p_limit: 100 });
  if (claimed.error) return new Response(null, { status: 503 });
  let removed = 0,
    failed = 0;
  for (const asset of claimed.data || []) {
    const result = await db.storage.from(asset.bucket).remove([asset.name]);
    if (result.error) {
      failed++;
      continue;
    }
    const finish = await db.rpc("finish_asset_cleanup", { p_id: asset.id });
    if (finish.error) {
      failed++;
      continue;
    }
    removed++;
  }
  return new Response(JSON.stringify({ removed, failed }), {
    status: failed ? 503 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
