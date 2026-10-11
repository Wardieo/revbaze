import { boundedBody } from "../_shared/tracking.ts";
import { checkoutReturnPath } from "../_shared/billing-core.ts";
import {
  appURL,
  configuration,
  database,
  env,
  paymongo,
  resolvePlan,
  response,
  rpc,
  subscriptions,
  reconcile,
} from "../_shared/billing-runtime.ts";
Deno.serve(async (request: Request) => {
  let origin: string | undefined,
    db: ReturnType<typeof database> | undefined,
    user: string | undefined,
    token: string | undefined;
  try {
    // Preflight carries no payment or authorization data. Let the browser reach
    // the POST so origin/configuration failures can be read instead of hidden by CORS.
    const callerOrigin = request.headers.get("origin") || undefined;
    if (request.method === "OPTIONS") return response({}, 200, callerOrigin);
    origin = callerOrigin || appURL();
    const configuredOrigin = appURL();
    const allowedOrigins = [
      configuredOrigin,
      ...(Deno.env.get("BILLING_ALLOWED_ORIGINS") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ];
    if (
      request.headers.get("origin") &&
      !allowedOrigins.includes(request.headers.get("origin")!)
    )
      return response(
        {
          error:
            "Checkout is not allowed from this website. Set APP_URL to the website origin or add it to BILLING_ALLOWED_ORIGINS in Supabase Edge Function secrets.",
        },
        403,
        origin,
      );

    if (request.method !== "POST")
      return response({ error: "Method not allowed" }, 405, origin);
    db = database();
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer "))
      return response({ error: "Sign in to manage billing" }, 401, origin);
    const { data, error } = await db.auth.getUser(auth.slice(7));
    if (error || !data.user)
      return response({ error: "Your session expired" }, 401, origin);
    user = data.user.id;
    const input = JSON.parse(
      new TextDecoder().decode(await boundedBody(request, 8192)),
    );
    if (
      !["status", "checkout", "cancel", "payment-method"].includes(input.action)
    )
      return response({ error: "Unknown billing action" }, 400, origin);
    if (input.action === "checkout" && !["growth", "pro"].includes(input.plan))
      return response({ error: "Choose Growth or Pro" }, 400, origin);
    const config = configuration();
    env("PAYMONGO_WEBHOOK_SECRET");
    if (config.currency !== "PHP")
      throw new Error("PayMongo subscriptions require PHP billing amounts");
    const lease = await rpc(db, "billing_claim", { p_user: user });
    if (lease.busy)
      return response(
        { error: "Billing is being updated. Please try again shortly." },
        409,
        origin,
      );
    token = lease.token;
    const found = await db
      .from("billing_customers")
      .select("*")
      .eq("user_id", user)
      .single();
    if (found.error) throw new Error("Could not read billing account");
    let row = found.data;
    if (!row.paymongo_customer_id && input.action === "status") {
      await rpc(db, "billing_release", { p_user: user, p_token: token });
      token = undefined;
      return response({ configured: true, hasCustomer: false }, 200, origin);
    }
    if (!row.paymongo_customer_id) {
      if (input.action !== "checkout")
        throw new Error("Choose a paid plan first");
      const metadata = data.user.user_metadata || {};
      const fullName = String(
        metadata.name || metadata.full_name || "Revbaze customer",
      )
        .trim()
        .split(/\s+/);
      const created = (
        await paymongo("customers", {
          first_name:
            String(metadata.first_name || fullName[0]).trim() || "Revbaze",
          last_name:
            String(metadata.last_name || fullName.slice(1).join(" ")).trim() ||
            "Customer",
          default_device: "email",
          ...(data.user.phone ? { phone: data.user.phone } : {}),
          email: data.user.email,
        })
      ).data;
      const saved = await db
        .from("billing_customers")
        .update({ paymongo_customer_id: created.id })
        .eq("user_id", user)
        .eq("lease_token", token);
      if (saved.error) throw new Error("Could not save billing account");
      row = { ...row, paymongo_customer_id: created.id };
    }
    const list = await subscriptions(row.paymongo_customer_id);
    if (input.action === "status") {
      const state = await reconcile(
        db,
        user!,
        token!,
        `sync_${crypto.randomUUID()}`,
        row,
        list,
      );
      token = undefined;
      return response(
        {
          configured: true,
          hasCustomer: true,
          status:
            list.find((s) => s.id === state.subscription)?.attributes.status ||
            state.status,
          cancelAtPeriodEnd: state.cancel,
          periodEnd: state.periodEnd,
        },
        200,
        origin,
      );
    }
    const ongoing = list.filter(
      (s) =>
        !["cancelled", "incomplete_cancelled"].includes(s.attributes.status),
    );
    if (ongoing.length > 1)
      throw new Error("Multiple subscriptions require support review");
    let subscription = ongoing[0];
    if (input.action === "cancel") {
      await reconcile(
        db,
        user!,
        token!,
        `pre_cancel_${crypto.randomUUID()}`,
        row,
        list,
      );
      token = undefined;
      const cancelLease = await rpc(db, "billing_claim", { p_user: user });
      if (cancelLease.busy)
        return response(
          { error: "Billing is being updated. Please retry." },
          409,
          origin,
        );
      token = cancelLease.token;
      if (subscription) row = { ...row, subscription_id: subscription.id };
      if (subscription)
        await paymongo(
          `subscriptions/${encodeURIComponent(subscription.id)}`,
          undefined,
          "DELETE",
        );
      await reconcile(db, user!, token!, `cancel_${crypto.randomUUID()}`, row);
      token = undefined;
      return response({ cancelled: true }, 200, origin);
    }
    let intentId: string | undefined;
    if (input.action === "payment-method") {
      if (!subscription || subscription.attributes.status !== "active")
        throw new Error("An active subscription is required");
      subscription = (
        await paymongo(
          `subscriptions/${encodeURIComponent(subscription.id)}/payment_method`,
          {},
          "PUT",
        )
      ).data;
      intentId = subscription.attributes.setup_intent?.id;
    } else {
      const plan = await resolvePlan(input.plan);
      if (subscription && subscription.attributes.status !== "incomplete") {
        if (subscription.attributes.status !== "active")
          throw new Error(
            "Resolve your unpaid subscription before changing plans",
          );
        await reconcile(
          db,
          user!,
          token!,
          `pre_change_${crypto.randomUUID()}`,
          row,
          list,
        );
        token = undefined;
        const changeLease = await rpc(db, "billing_claim", { p_user: user });
        if (changeLease.busy)
          return response(
            { error: "Billing is being updated. Please retry." },
            409,
            origin,
          );
        token = changeLease.token;
        const desired = await db
          .from("billing_customers")
          .update({ desired_plan: input.plan })
          .eq("user_id", user)
          .eq("lease_token", token);
        if (desired.error) throw new Error("Could not record requested plan");
        const currentPlan =
          subscription.attributes.plan?.id || subscription.attributes.plan_id;
        if (currentPlan !== plan)
          await paymongo(
            `subscriptions/${encodeURIComponent(subscription.id)}/plan`,
            { plan_id: plan },
            "PUT",
          );
        await rpc(db, "billing_release", { p_user: user, p_token: token });
        token = undefined;
        return response({ scheduled: true }, 200, origin);
      }
      if (
        subscription &&
        (subscription.attributes.plan?.id ||
          subscription.attributes.plan_id) !== plan
      )
        throw new Error(
          "Finish or cancel your pending subscription before choosing a different plan",
        );
      if (!subscription)
        subscription = (
          await paymongo("subscriptions", {
            customer_id: row.paymongo_customer_id,
            plan_id: plan,
          })
        ).data;
      intentId = subscription.attributes.latest_invoice?.payment_intent?.id;
    }
    if (!intentId) throw new Error("PayMongo did not return a payment intent");
    const intent = (
      await paymongo(`payment_intents/${encodeURIComponent(intentId)}`)
    ).data;
    const saved = await db
      .from("billing_customers")
      .update({
        subscription_id: subscription.id,
        ...(input.action === "checkout" ? { desired_plan: input.plan } : {}),
      })
      .eq("user_id", user)
      .eq("lease_token", token);
    if (saved.error) throw new Error("Could not save subscription");
    await rpc(db, "billing_release", {
      p_user: user,
      p_token: token,
      p_checkout: subscription.id,
      p_plan: input.plan,
    });
    token = undefined;
    return response(
      {
        payment: {
          purpose:
            input.action === "payment-method"
              ? "payment-method"
              : "subscription",
          intentId,
          clientKey: intent.attributes.client_key,
          publicKey: env("PAYMONGO_PUBLIC_KEY"),
          amount: intent.attributes.amount,
          currency: intent.attributes.currency,
          methods: (
            intent.attributes.payment_method_allowed || ["card", "paymaya"]
          ).filter((m: string) => ["card", "paymaya"].includes(m)),
          returnUrl:
            input.action === "payment-method"
              ? `${origin}/#/settings?tab=billing&checkout=success`
              : `${origin}/#/checkout?result=success&plan=${input.plan}&returnTo=${encodeURIComponent(checkoutReturnPath(input.returnTo))}`,
        },
      },
      200,
      origin,
    );
  } catch (e) {
    if (db && user && token)
      await db.rpc("billing_release", { p_user: user, p_token: token });
    console.error(
      "Billing operation failed",
      e instanceof Error ? e.message : "Unknown error",
    );
    return response(
      { error: e instanceof Error ? e.message : "Billing unavailable" },
      503,
      origin,
    );
  }
});
