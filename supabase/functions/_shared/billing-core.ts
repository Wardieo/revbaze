export type Price = {
  id: string;
  active: boolean;
  product: string | { id: string };
  currency: string;
  unit_amount: number;
  recurring?: { interval: string; interval_count: number };
  billing_scheme?: string;
  type?: string;
};
export type Subscription = {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  latest_invoice?: { status: string; paid?: boolean } | string | null;
  current_period_end?: number;
  items: {
    data: Array<{
      quantity: number;
      current_period_end?: number;
      price: Price;
    }>;
  };
};
export function validPrice(
  price: Price,
  plan: "growth" | "pro",
  configured: string,
) {
  const product =
    typeof price.product === "string" ? price.product : price.product.id;
  return (
    (configured.startsWith("price_")
      ? price.id === configured
      : product === configured) &&
    price.currency === "usd" &&
    price.unit_amount === (plan === "growth" ? 1000 : 2900) &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1 &&
    (!price.billing_scheme || price.billing_scheme === "per_unit")
  );
}
export function entitlement(
  subscriptions: Subscription[],
  config: { growth: string; pro: string },
  now = Date.now(),
) {
  const choices = subscriptions.flatMap((s) => {
    if (!["active", "trialing"].includes(s.status) || s.items.data.length !== 1)
      return [];
    // A redirect or an active subscription with an unpaid invoice is not payment confirmation.
    if (
      s.status === "active" &&
      (typeof s.latest_invoice !== "object" ||
        s.latest_invoice?.status !== "paid")
    )
      return [];
    const item = s.items.data[0];
    const end = item.current_period_end ?? s.current_period_end;
    if (item.quantity !== 1 || !end || end * 1000 <= now) return [];
    const plan = validPrice(item.price, "pro", config.pro)
      ? "pro"
      : validPrice(item.price, "growth", config.growth)
        ? "growth"
        : null;
    return plan
      ? [
          {
            plan,
            subscription: s.id,
            status: s.status,
            periodEnd: new Date(end * 1000).toISOString(),
            cancel: !!s.cancel_at_period_end,
          },
        ]
      : [];
  });
  choices.sort((a, b) => Number(b.plan === "pro") - Number(a.plan === "pro"));
  return (
    choices[0] ?? {
      plan: "free",
      subscription: null,
      status: "inactive",
      periodEnd: null,
      cancel: false,
    }
  );
}
// Stripe's documented v1 signature: HMAC-SHA256(timestamp + '.' + untouched body).
export async function verifySignature(
  body: string,
  header: string,
  secret: string,
  now = Date.now(),
) {
  const parts = header.split(",").map((p) => p.split("="));
  const timestamp = parts.find((p) => p[0] === "t")?.[1];
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  )
    throw new Error("Invalid webhook signature");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  for (const [kind, value] of parts)
    if (kind === "v1" && /^[a-f0-9]{64}$/.test(value)) {
      const signature = new Uint8Array(
        value.match(/../g)!.map((v) => parseInt(v, 16)),
      );
      if (
        await crypto.subtle.verify(
          "HMAC",
          key,
          signature,
          new TextEncoder().encode(`${timestamp}.${body}`),
        )
      )
        return;
    }
  throw new Error("Invalid webhook signature");
}
// Checkout redirects accept only local application pages, never arbitrary URLs.
export function checkoutReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 500 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/upgrade";
  try {
    const url = new URL(value, "https://revbaze.invalid");
    if (
      url.origin !== "https://revbaze.invalid" ||
      ![
        "/start-plan",
        "/upgrade",
        "/settings",
        "/overview",
        "/analytics",
        "/integrations",
        "/cards",
        "/qr-codes",
      ].includes(url.pathname)
    )
      return "/upgrade";
    for (const key of ["checkout", "result", "plan", "returnTo"])
      url.searchParams.delete(key);
    return url.pathname + url.search;
  } catch {
    return "/upgrade";
  }
}
