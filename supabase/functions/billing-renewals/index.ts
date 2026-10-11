import {
  database,
  env,
  paymongo,
  response,
  rpc,
  subscriptions,
  resolvePlan,
  reconcile,
} from "../_shared/billing-runtime.ts";
Deno.serve(async (request: Request) => {
  const secret = env("BILLING_RENEWAL_SECRET");
  if (
    secret.length < 32 ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  )
    return response({ error: "Unauthorized" }, 401);
  if (request.method !== "POST") return response({}, 405);
  const db = database();
  const rows = await db
    .from("billing_customers")
    .select("*")
    .not("paymongo_customer_id", "is", null)
    .or(
      `fx_checked_at.is.null,fx_checked_at.lt.${new Date(Date.now() - 86400000).toISOString()}`,
    )
    .order("fx_checked_at", { nullsFirst: true })
    .limit(10);
  if (rows.error) return response({ error: "Could not load renewals" }, 503);
  let failed = 0;
  for (const row of rows.data || []) {
    let token: string | undefined;
    try {
      const lease = await rpc(db, "billing_claim", { p_user: row.user_id });
      if (lease.busy) continue;
      token = lease.token;
      const list = await subscriptions(row.paymongo_customer_id);
      // Reconcile before changing the plan so the old paid invoice remains recorded.
      await reconcile(
        db,
        row.user_id,
        token!,
        `renewal_sync_${crypto.randomUUID()}`,
        row,
        list,
      );
      token = undefined;
      const nextLease = await rpc(db, "billing_claim", { p_user: row.user_id });
      if (nextLease.busy) continue;
      token = nextLease.token;
      for (const s of list.filter((s) => s.attributes.status === "active")) {
        const old = s.attributes.plan?.id || s.attributes.plan_id;
        const quote = await db
          .from("billing_quotes")
          .select("plan")
          .eq("provider_plan_id", old)
          .maybeSingle();
        if (quote.error || !quote.data)
          throw new Error("Unknown subscription plan");
        // A finalized invoice is not repriced. These changes apply to future cycles only.
        const id = await resolvePlan(row.desired_plan || quote.data.plan);
        if (id !== old)
          await paymongo(
            `subscriptions/${encodeURIComponent(s.id)}/plan`,
            { plan_id: id },
            "PUT",
          );
      }
      const saved = await db
        .from("billing_customers")
        .update({ fx_checked_at: new Date().toISOString() })
        .eq("user_id", row.user_id)
        .eq("lease_token", token);
      if (saved.error) throw new Error("Could not record repricing");
      await rpc(db, "billing_release", { p_user: row.user_id, p_token: token });
      token = undefined;
    } catch {
      failed++;
      if (token)
        await db.rpc("billing_release", {
          p_user: row.user_id,
          p_token: token,
        });
    }
  }
  return response(
    { checked: rows.data?.length || 0, failed },
    failed ? 503 : 200,
  );
});
