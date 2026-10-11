import { boundedBody } from "../_shared/tracking.ts";
import { checkoutReturnPath } from "../_shared/billing-core.ts";
import {
  appURL,
  configuration,
  database,
  env,
  resolvePrice,
  response,
  rpc,
  stripe,
  subscriptions,
} from "../_shared/billing-runtime.ts";
Deno.serve(async (request: Request) => {
  let origin: string | undefined;
  let db: ReturnType<typeof database> | undefined;
  let userId: string | undefined;
  let token: string | undefined;
  try {
    origin = appURL();
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== origin
    )
      return response({ error: "Origin is not allowed" }, 403);
    if (request.method === "OPTIONS") return response({}, 200, origin);
    if (request.method !== "POST")
      return response({ error: "Method not allowed" }, 405, origin);
    db = database();
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer "))
      return response({ error: "Sign in to manage billing." }, 401, origin);
    const { data, error } = await db.auth.getUser(authorization.slice(7));
    if (error || !data.user)
      return response(
        { error: "Your session expired. Sign in again." },
        401,
        origin,
      );
    userId = data.user.id;
    const input = JSON.parse(
      new TextDecoder().decode(await boundedBody(request, 8192)),
    );
    const configuredPortal = Deno.env.get("STRIPE_PORTAL_CONFIGURATION_ID");
    const portalOptions: Record<string, string> = configuredPortal
      ? { configuration: configuredPortal }
      : {};
    const returnTo = checkoutReturnPath(input.returnTo);
    const successURL = `${origin}/#/checkout?result=success&plan=${input.plan}&returnTo=${encodeURIComponent(returnTo)}`;
    const cancelURL = `${origin}/#/checkout?result=cancelled&returnTo=${encodeURIComponent(returnTo)}`;
    const existing = await db
      .from("billing_customers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.error) {
      console.error(
        "Billing customer lookup failed",
        existing.error.code,
        existing.error.message,
      );
      throw new Error("Billing setup is incomplete. Please contact support.");
    }
    if (input.action === "status")
      return response(
        {
          configured:
            !!Deno.env.get("STRIPE_SECRET_KEY") &&
            !!Deno.env.get("STRIPE_GROWTH_PRICE_ID") &&
            !!Deno.env.get("STRIPE_PRO_PRICE_ID") &&
            !!Deno.env.get("STRIPE_WEBHOOK_SECRET"),
          hasCustomer: !!existing.data,
          status: existing.data?.status,
          cancelAtPeriodEnd: existing.data?.cancel_at_period_end,
          periodEnd: existing.data?.period_end,
        },
        200,
        origin,
      );
    if (!["checkout", "portal"].includes(input.action))
      return response({ error: "Unknown billing action" }, 400, origin);
    env("STRIPE_SECRET_KEY");
    configuration();
    let customer = existing.data?.stripe_customer_id;
    if (input.action === "portal") {
      if (!customer)
        return response(
          { error: "No billing account yet. Choose a paid plan first." },
          400,
          origin,
        );
      const portal = await stripe("billing_portal/sessions", {
        customer,
        return_url: `${origin}/#/settings?tab=billing`,
        ...portalOptions,
      });
      return response({ url: portal.url }, 200, origin);
    }
    if (!["growth", "pro"].includes(input.plan))
      return response({ error: "Choose Growth or Pro." }, 400, origin);
    env("STRIPE_WEBHOOK_SECRET");
    const price = await resolvePrice(input.plan);
    // Stripe uses the customer email for subscription invoice receipts.
    // Keep existing billing customers in sync after an account email change.
    if (customer && data.user.email) {
      await stripe(`customers/${encodeURIComponent(customer)}`, {
        email: data.user.email,
      });
    }
    if (!customer) {
      const created = await stripe(
        "customers",
        {
          "metadata[revbaze_user_id]": userId,
          ...(data.user.email ? { email: data.user.email } : {}),
        },
        `revbaze-customer-${userId}`,
      );
      const saved = await db
        .from("billing_customers")
        .upsert(
          { user_id: userId, stripe_customer_id: created.id },
          { onConflict: "user_id", ignoreDuplicates: true },
        );
      if (saved.error) throw new Error("Could not save billing customer.");
      const mapping = await db
        .from("billing_customers")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .single();
      if (mapping.error) throw new Error("Could not load billing customer.");
      customer = mapping.data.stripe_customer_id;
    }
    const lease = await rpc(db, "billing_claim", { p_user: userId });
    if (lease.busy)
      return response(
        {
          error:
            "Another billing request is in progress. Please try again shortly.",
        },
        409,
        origin,
      );
    token = lease.token;
    const current = await subscriptions(customer);
    if (
      current.some(
        (s: { status: string }) =>
          !["canceled", "incomplete_expired"].includes(s.status),
      )
    ) {
      const ongoing = current.filter(
        (s: { status: string }) =>
          !["canceled", "incomplete_expired"].includes(s.status),
      );
      const subscription = ongoing.length === 1 ? ongoing[0] : null;
      const item =
        subscription?.items?.data?.length === 1
          ? subscription.items.data[0]
          : null;
      const confirmation: Record<string, string> = {};
      if (
        subscription &&
        ["active", "trialing"].includes(subscription.status) &&
        item?.id &&
        item.price.id !== price
      ) {
        if (item.price.unit_amount < (input.plan === "growth" ? 1000 : 2900)) {
          const portalConfig = configuredPortal
            ? await stripe(
                `billing_portal/configurations/${encodeURIComponent(configuredPortal)}`,
              )
            : (
                await stripe(
                  "billing_portal/configurations?active=true&limit=100",
                )
              ).data.find((c: { is_default: boolean }) => c.is_default);
          if (
            portalConfig?.features?.subscription_update?.proration_behavior !==
            "always_invoice"
          ) {
            throw new Error(
              "Enable immediate invoicing for subscription upgrades in Stripe’s customer portal settings before upgrading.",
            );
          }
        }
        confirmation["flow_data[type]"] = "subscription_update_confirm";
        confirmation["flow_data[subscription_update_confirm][subscription]"] =
          subscription.id;
        confirmation["flow_data[subscription_update_confirm][items][0][id]"] =
          item.id;
        confirmation[
          "flow_data[subscription_update_confirm][items][0][price]"
        ] = price;
        confirmation[
          "flow_data[subscription_update_confirm][items][0][quantity]"
        ] = "1";
        confirmation["flow_data[after_completion][type]"] = "redirect";
        confirmation["flow_data[after_completion][redirect][return_url]"] =
          successURL;
      }
      const portal = await stripe("billing_portal/sessions", {
        customer,
        return_url: `${origin}/#/settings?tab=billing`,
        ...portalOptions,
        ...confirmation,
      });
      await rpc(db, "billing_release", { p_user: userId, p_token: token });
      token = undefined;
      return response({ url: portal.url }, 200, origin);
    }
    if (lease.checkout) {
      const previous = await stripe(
        `checkout/sessions/${encodeURIComponent(lease.checkout)}`,
      );
      if (
        previous.status === "open" &&
        lease.checkout_plan === input.plan &&
        previous.success_url === successURL &&
        previous.cancel_url === cancelURL &&
        previous.metadata?.revbaze_trial_days === "0"
      ) {
        await rpc(db, "billing_release", { p_user: userId, p_token: token });
        token = undefined;
        return response({ url: previous.url }, 200, origin);
      }
      if (previous.status === "open")
        await stripe(
          `checkout/sessions/${encodeURIComponent(lease.checkout)}/expire`,
          {},
        );
      if (
        previous.status === "complete" &&
        current.some(
          (s: { status: string }) =>
            !["canceled", "incomplete_expired"].includes(s.status),
        )
      ) {
        await rpc(db, "billing_release", { p_user: userId, p_token: token });
        token = undefined;
        return response(
          {
            error:
              "Your previous checkout is being confirmed. Please wait before starting another subscription.",
          },
          409,
          origin,
        );
      }
    }
    // Recover sessions created before an interrupted database save.
    const recover = await stripe(
      `checkout/sessions?customer=${encodeURIComponent(customer)}&limit=100`,
    );
    if (recover.has_more)
      throw new Error(
        "Billing history requires reconciliation before starting checkout.",
      );
    for (const pending of recover.data.filter(
      (s: { status: string; client_reference_id: string }) =>
        s.status === "open" && s.client_reference_id === userId,
    )) {
      if (
        pending.metadata?.revbaze_plan === input.plan &&
        pending.success_url === successURL &&
        pending.cancel_url === cancelURL &&
        pending.metadata?.revbaze_trial_days === "0"
      ) {
        await rpc(db, "billing_release", {
          p_user: userId,
          p_token: token,
          p_checkout: pending.id,
          p_plan: input.plan,
        });
        token = undefined;
        return response({ url: pending.url }, 200, origin);
      }
      await stripe(
        `checkout/sessions/${encodeURIComponent(pending.id)}/expire`,
        {},
      );
    }
    const session = await stripe(
      "checkout/sessions",
      {
        mode: "subscription",
        ui_mode: "hosted",
        customer,
        "line_items[0][price]": price,
        "line_items[0][quantity]": "1",
        client_reference_id: userId,
        "metadata[revbaze_user_id]": userId,
        "metadata[revbaze_plan]": input.plan,
        "metadata[revbaze_trial_days]": "0",
        "subscription_data[metadata][revbaze_user_id]": userId,
        billing_address_collection: "auto",
        payment_method_collection: "always",
        success_url: successURL,
        cancel_url: cancelURL,
      },
      `revbaze-checkout-${userId}-${token}`,
    );
    await rpc(db, "billing_release", {
      p_user: userId,
      p_token: token,
      p_checkout: session.id,
      p_plan: input.plan,
    });
    token = undefined;
    return response({ url: session.url }, 200, origin);
  } catch (error) {
    if (db && userId && token)
      await db.rpc("billing_release", { p_user: userId, p_token: token });
    console.error(
      "Billing request failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start billing. Please try again.",
      },
      503,
      origin,
    );
  }
});
