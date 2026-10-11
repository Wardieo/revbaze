import { createClient } from "npm:@supabase/supabase-js@2.109.0";
import { entitlement, type Resource } from "./billing-core.ts";
export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Billing setup is incomplete: ${name}`);
  return value;
}
export function appURL() {
  const u = new URL(env("APP_URL"));
  if (
    u.protocol !== "https:" &&
    !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))
  )
    throw new Error("APP_URL must use HTTPS");
  return u.origin;
}
export function configuration() {
  const secret = env("PAYMONGO_SECRET_KEY"),
    publicKey = env("PAYMONGO_PUBLIC_KEY");
  if (
    !/^sk_(test|live)_/.test(secret) ||
    !publicKey.startsWith(
      secret.startsWith("sk_live_") ? "pk_live_" : "pk_test_",
    )
  )
    throw new Error("PayMongo key mode mismatch");
  return {
    growth: "",
    pro: "",
    growthAmount: 1000,
    proAmount: 2900,
    currency: "PHP",
    live: secret.startsWith("sk_live_"),
  };
}
export function database() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function paymongo(
  path: string,
  attributes?: Record<string, unknown>,
  method = attributes ? "POST" : "GET",
) {
  const res = await fetch(`https://api.paymongo.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(env("PAYMONGO_SECRET_KEY") + ":")}`,
      "Content-Type": "application/json",
    },
    body: attributes ? JSON.stringify({ data: { attributes } }) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  let value;
  try {
    value = await res.json();
  } catch {
    throw new Error(
      `PayMongo returned an unreadable response (HTTP ${res.status}). Please try again or contact support.`,
    );
  }
  if (!res.ok) {
    // Log codes/field names only, never API keys, request bodies or provider detail text.
    const codes = Array.isArray(value.errors)
      ? value.errors.map((e: { code?: unknown }) =>
          typeof e.code === "string" && /^[a-z_]+$/.test(e.code)
            ? e.code
            : "unknown",
        )
      : [];
    const knownFields = new Set([
      "data",
      "attributes",
      "first_name",
      "last_name",
      "email",
      "phone",
      "default_device",
      "interval",
      "interval_count",
      "amount",
      "currency",
      "name",
      "customer_id",
      "plan_id",
      "payment_method_id",
    ]);
    const fields = Array.isArray(value.errors)
      ? value.errors.flatMap(
          (e: { source?: { attribute?: unknown; pointer?: unknown } }) => {
            const pointer = e.source?.attribute || e.source?.pointer;
            return typeof pointer === "string"
              ? pointer.split(/[/.]/).filter((field) => knownFields.has(field))
              : [];
          },
        )
      : [];
    const operation = `${method} ${path.startsWith("subscriptions/plans") ? "subscriptions/plans" : path.split(/[/?]/)[0]}`;
    const fieldNames = [...new Set(fields)].join(",");
    console.error(
      "PayMongo request failed",
      res.status,
      codes.join(","),
      operation,
      fieldNames ? `fields=${fieldNames}` : "fields=unspecified",
    );
    if (res.status === 401)
      throw new Error(
        "PayMongo rejected the API key. Check PAYMONGO_SECRET_KEY in Supabase Edge Function secrets.",
      );
    if (res.status === 403)
      throw new Error(
        "PayMongo denied billing access. Confirm Subscriptions is enabled on your merchant account and your API keys have access.",
      );
    if (res.status === 404)
      throw new Error(
        "PayMongo could not find the billing resource. Confirm Subscriptions is enabled on your merchant account.",
      );
    throw new Error(
      `PayMongo rejected ${operation} (HTTP ${res.status})${fieldNames ? `: check ${fieldNames}` : ""}. Check the billing function logs for the provider error code.`,
    );
  }
  return value;
}
export async function subscriptions(customer: string): Promise<Resource[]> {
  const list = await paymongo(
    `subscriptions?customer_id=${encodeURIComponent(customer)}&limit=100`,
  );
  if (list.has_more || list.data.length >= 100)
    throw new Error("Subscription history requires manual review");
  return Promise.all(
    list.data.map((s: Resource) =>
      paymongo(`subscriptions/${encodeURIComponent(s.id)}`).then((v) => v.data),
    ),
  );
}
export async function resolvePlan(name: "growth" | "pro") {
  const db = database(),
    day = new Date().toISOString().slice(0, 10);
  let result = await db
    .from("billing_fx_rates")
    .select("*")
    .eq("day", day)
    .maybeSingle();
  if (result.error) throw new Error("FX cache unavailable");
  if (!result.data) {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error("Exchange rate unavailable. Please try again later");
    const fx = await response.json();
    const rate = fx.rates?.PHP,
      updated = Number(fx.time_last_update_unix) * 1000;
    if (
      fx.result !== "success" ||
      fx.base_code !== "USD" ||
      typeof rate !== "number" ||
      rate < 1 ||
      rate > 1000 ||
      !Number.isFinite(updated) ||
      Date.now() - updated > 36 * 3600000 ||
      updated > Date.now() + 60000
    )
      throw new Error("A fresh USD/PHP rate is unavailable");
    const saved = await db
      .from("billing_fx_rates")
      .upsert(
        { day, rate, source_updated_at: new Date(updated).toISOString() },
        { onConflict: "day", ignoreDuplicates: true },
      );
    if (saved.error) throw new Error("Could not cache exchange rate");
    result = await db
      .from("billing_fx_rates")
      .select("*")
      .eq("day", day)
      .single();
    if (result.error) throw new Error("FX cache unavailable");
  }
  if (Date.now() - Date.parse(result.data.source_updated_at) > 36 * 3600000)
    throw new Error("A fresh USD/PHP rate is unavailable");
  const usd = name === "growth" ? 1000 : 2900,
    rate = Number(result.data.rate),
    amount = Math.round(usd * rate);
  const quote = await rpc(db, "billing_quote_claim", {
    p_day: day,
    p_live: configuration().live,
    p_plan: name,
    p_usd: usd,
    p_php: amount,
    p_rate: rate,
  });
  if (quote.busy)
    throw new Error("Pricing is being prepared. Please try again shortly");
  if (quote.provider_plan_id) return quote.provider_plan_id;
  const value = (
    await paymongo("subscriptions/plans", {
      name: `Revbaze ${name} USD ${usd / 100} (${day})`,
      amount: quote.php_amount,
      currency: "PHP",
      interval: "monthly",
      interval_count: 1,
    })
  ).data;
  const saved = await db
    .from("billing_quotes")
    .update({
      provider_plan_id: value.id,
      lease_token: null,
      lease_until: null,
    })
    .eq("day", day)
    .eq("livemode", configuration().live)
    .eq("plan", name)
    .eq("lease_token", quote.token)
    .select("provider_plan_id")
    .single();
  if (saved.error || saved.data?.provider_plan_id !== value.id)
    throw new Error("Could not save billing quote");
  return value.id;
}
export async function verifiedEntitlement(
  db: ReturnType<typeof database>,
  items: Resource[],
) {
  const choices = [];
  for (const item of items) {
    const id = item.attributes.plan?.id || item.attributes.plan_id;
    if (!id) continue;
    const quote = await db
      .from("billing_quotes")
      .select("*")
      .eq("provider_plan_id", id)
      .maybeSingle();
    if (quote.error) throw new Error("Could not verify subscription price");
    if (!quote.data) continue;
    const q = quote.data;
    if (q.livemode !== configuration().live) continue;
    if (q.usd_amount !== (q.plan === "growth" ? 1000 : 2900)) continue;
    const c = {
      ...configuration(),
      [q.plan]: id,
      [q.plan === "growth" ? "growthAmount" : "proAmount"]: q.php_amount,
    };
    const state = entitlement([item], c);
    if (state.plan !== "free") choices.push(state);
  }
  choices.sort((a, b) => Number(b.plan === "pro") - Number(a.plan === "pro"));
  return choices[0] ?? entitlement([], configuration());
}
export async function reconcile(
  db: ReturnType<typeof database>,
  user: string,
  token: string,
  event: string,
  row: any,
  items?: Resource[],
) {
  const list = items ?? (await subscriptions(row.paymongo_customer_id));
  let state = await verifiedEntitlement(db, list);
  // Preserve only a previously verified paid period, including after cancellation or a next-cycle plan change.
  const prior = await db
    .from("account_plans")
    .select("plan,expires_at")
    .eq("user_id", user)
    .maybeSingle();
  if (prior.error) throw new Error("Could not read current entitlement");
  if (
    state.plan === "free" &&
    prior.data &&
    Date.parse(prior.data.expires_at) > Date.now() &&
    ["growth", "pro"].includes(prior.data.plan)
  )
    state = {
      plan: prior.data.plan,
      subscription: row.subscription_id,
      status: "active",
      periodEnd: prior.data.expires_at,
      cancel: list.some((s) => s.attributes.status === "cancelled"),
    };
  await rpc(db, "billing_apply", {
    p_user: user,
    p_token: token,
    p_event: event,
    p_plan: state.plan,
    p_subscription: state.subscription,
    p_status: state.status,
    p_period_end: state.periodEnd,
    p_cancel: state.cancel,
  });
  return state;
}
export async function rpc(
  db: ReturnType<typeof database>,
  name: string,
  args: Record<string, unknown>,
) {
  const result = await db.rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export function response(data: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(origin
        ? {
            "Access-Control-Allow-Origin": origin,
            Vary: "Origin",
            "Access-Control-Allow-Headers":
              "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          }
        : {}),
    },
  });
}
