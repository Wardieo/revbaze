import { boundedBody } from "../_shared/tracking.ts";
import { verifySignature } from "../_shared/billing-core.ts";
import {
  configuration,
  database,
  env,
  response,
  rpc,
  reconcile,
} from "../_shared/billing-runtime.ts";
Deno.serve(async (request: Request) => {
  if (request.method !== "POST")
    return response({ error: "Method not allowed" }, 405);
  let event;
  try {
    const body = new TextDecoder().decode(await boundedBody(request, 262144));
    await verifySignature(
      body,
      request.headers.get("Paymongo-Signature") || "",
      env("PAYMONGO_WEBHOOK_SECRET"),
      configuration().live,
    );
    event = JSON.parse(body).data;
    if (!event?.id || event.attributes?.livemode !== configuration().live)
      throw new Error("Invalid event");
  } catch {
    return response({ error: "Invalid webhook signature or mode" }, 400);
  }
  const type = event.attributes.type;
  if (!type?.startsWith("subscription.")) return response({ received: true });
  let db: ReturnType<typeof database> | undefined,
    user: string | undefined,
    token: string | undefined;
  try {
    const object = event.attributes.data,
      customer = object?.attributes?.customer_id;
    if (!customer) throw new Error("Missing customer in subscription event");
    db = database();
    const mapping = await db
      .from("billing_customers")
      .select("*")
      .eq("paymongo_customer_id", customer)
      .maybeSingle();
    if (mapping.error) throw new Error("Customer lookup failed");
    if (!mapping.data) return response({ received: true });
    user = mapping.data.user_id;
    const lease = await rpc(db, "billing_claim", {
      p_user: user,
      p_event: event.id,
    });
    if (lease.processed) return response({ received: true });
    if (lease.busy) return response({ error: "Retry reconciliation" }, 503);
    token = lease.token;
    await reconcile(db, user!, token!, event.id, mapping.data);
    token = undefined;
    return response({ received: true });
  } catch {
    if (db && user && token)
      await db.rpc("billing_release", { p_user: user, p_token: token });
    return response(
      { error: "Subscription synchronization failed; retry" },
      503,
    );
  }
});
