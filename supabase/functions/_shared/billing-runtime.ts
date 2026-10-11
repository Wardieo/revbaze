import { createClient } from "npm:@supabase/supabase-js@2.109.0";
import { validPrice, type Price } from "./billing-core.ts";
export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Billing setup is incomplete: ${name}`);
  return value;
}
export function appURL() {
  const url = new URL(env("APP_URL"));
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("APP_URL must use HTTPS");
  return url.origin;
}
export function configuration() {
  return {
    growth: env("STRIPE_GROWTH_PRICE_ID"),
    pro: env("STRIPE_PRO_PRICE_ID"),
  };
}
export function database() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function stripe(
  path: string,
  body?: Record<string, string>,
  idempotency?: string,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
    "Stripe-Version": "2025-09-30.clover",
  };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotency) headers["Idempotency-Key"] = idempotency;
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? new URLSearchParams(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) {
    console.error(
      "Stripe operation failed",
      response.status,
      result.error?.code,
    );
    throw new Error(
      "Stripe could not complete this billing request. Check your billing configuration or try again.",
    );
  }
  return result;
}
export async function resolvePrice(plan: "growth" | "pro") {
  const configured = configuration()[plan];
  let prices: Price[];
  if (configured.startsWith("price_"))
    prices = [await stripe(`prices/${encodeURIComponent(configured)}`)];
  else if (configured.startsWith("prod_")) {
    const result = await stripe(
      `prices?product=${encodeURIComponent(configured)}&active=true&limit=100`,
    );
    if (result.has_more)
      throw new Error(
        "Configure an explicit recurring Price ID for this plan.",
      );
    prices = result.data;
  } else
    throw new Error("Configure a Stripe Product or Price ID for this plan.");
  const matches = prices.filter(
    (p) => p.active && validPrice(p, plan, configured),
  );
  if (matches.length !== 1)
    throw new Error(
      `Configure exactly one active ${plan === "growth" ? "$10" : "$29"} USD monthly price, or set its explicit Price ID.`,
    );
  return matches[0].id;
}
export async function subscriptions(customer: string) {
  const result = await stripe(
    `subscriptions?customer=${encodeURIComponent(customer)}&status=all&limit=100&expand%5B%5D=data.latest_invoice`,
  );
  if (result.has_more)
    throw new Error("Subscription reconciliation requires manual review.");
  return result.data;
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
