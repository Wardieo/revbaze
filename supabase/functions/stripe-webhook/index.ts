import { boundedBody } from "../_shared/tracking.ts";
import { entitlement, verifySignature } from "../_shared/billing-core.ts";
import {
  configuration,
  database,
  env,
  response,
  rpc,
  subscriptions,
} from "../_shared/billing-runtime.ts";
const events = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);
Deno.serve(async (request: Request) => {
  if (request.method !== "POST")
    return response({ error: "Method not allowed" }, 405);
  let event;
  try {
    const body = new TextDecoder().decode(await boundedBody(request, 262144));
    await verifySignature(
      body,
      request.headers.get("Stripe-Signature") ?? "",
      env("STRIPE_WEBHOOK_SECRET"),
    );
    event = JSON.parse(body);
  } catch {
    return response({ error: "Webhook signature validation failed" }, 400);
  }
  let db: ReturnType<typeof database> | undefined;
  let userId: string | undefined;
  let token: string | undefined;
  try {
    if (event.livemode !== /^(sk|rk)_live_/.test(env("STRIPE_SECRET_KEY")))
      return response({ error: "Stripe mode mismatch" }, 400);
    if (!events.has(event.type)) return response({ received: true });
    const object = event.data.object;
    const customer =
      typeof object.customer === "string"
        ? object.customer
        : object.customer?.id;
    if (!customer) return response({ received: true });
    db = database();
    const mapping = await db
      .from("billing_customers")
      .select("user_id")
      .eq("stripe_customer_id", customer)
      .maybeSingle();
    if (mapping.error) throw new Error("Billing customer lookup failed");
    if (!mapping.data) return response({ received: true });
    userId = mapping.data.user_id;
    const lease = await rpc(db, "billing_claim", {
      p_user: userId,
      p_event: event.id,
    });
    if (lease.processed) return response({ received: true });
    if (lease.busy)
      return response({ error: "Reconciliation in progress; retry" }, 503);
    token = lease.token;
    // Read current Stripe state under a lease; delayed events never restore old access.
    const state = entitlement(await subscriptions(customer), configuration());
    await rpc(db, "billing_apply", {
      p_user: userId,
      p_token: token,
      p_event: event.id,
      p_plan: state.plan,
      p_subscription: state.subscription,
      p_status: state.status,
      p_period_end: state.periodEnd,
      p_cancel: state.cancel,
    });
    token = undefined;
    return response({ received: true });
  } catch (error) {
    if (db && userId && token)
      await db.rpc("billing_release", { p_user: userId, p_token: token });
    console.error(
      "Stripe reconciliation failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return response(
      { error: "Subscription synchronization failed; retry" },
      503,
    );
  }
});
