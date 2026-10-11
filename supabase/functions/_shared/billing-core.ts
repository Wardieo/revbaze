export type BillingConfig = {
  growth: string;
  pro: string;
  growthAmount: number;
  proAmount: number;
  currency: string;
  live: boolean;
};
export type Resource = { id: string; attributes: Record<string, any> };
export function validPlan(
  plan: any,
  name: "growth" | "pro",
  config: BillingConfig,
) {
  return (
    plan?.id === config[name] &&
    plan.amount === config[name === "growth" ? "growthAmount" : "proAmount"] &&
    plan.currency?.toUpperCase() === config.currency &&
    ["month", "monthly"].includes(plan.interval) &&
    plan.interval_count === 1 &&
    plan.type !== "on_demand"
  );
}
// A provider status alone is not payment evidence. Match the invoice to the configured price.
export type Entitlement = {
  plan: "free" | "growth" | "pro";
  subscription: string | null;
  status: string;
  periodEnd: string | null;
  cancel: boolean;
};
export function entitlement(
  items: Resource[],
  config: BillingConfig,
  now = Date.now(),
): Entitlement {
  const choices = items.flatMap((s) => {
    const a = s.attributes,
      invoice = a.latest_invoice;
    const plan = ["growth", "pro"].find((name) =>
      validPlan(a.plan, name as "growth" | "pro", config),
    ) as "growth" | "pro" | undefined;
    const end = Date.parse(a.next_billing_schedule);
    if (
      !plan ||
      a.livemode !== config.live ||
      a.status !== "active" ||
      invoice?.status !== "paid" ||
      invoice.amount !==
        config[plan === "growth" ? "growthAmount" : "proAmount"] ||
      invoice.currency?.toUpperCase() !== config.currency ||
      !Number.isFinite(end) ||
      end <= now
    )
      return [];
    return [
      {
        plan,
        subscription: s.id,
        status: "active",
        periodEnd: new Date(end).toISOString(),
        cancel: false,
      },
    ];
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
export async function verifySignature(
  body: string,
  header: string,
  secret: string,
  live = false,
  now = Date.now(),
) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=")),
  );
  const stamp = parts.t,
    signature = parts[live ? "li" : "te"];
  if (
    !/^\d+$/.test(stamp || "") ||
    Math.abs(now / 1000 - Number(stamp)) > 300 ||
    !/^[a-f0-9]{64}$/.test(signature || "")
  )
    throw new Error("Invalid webhook signature");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      key,
      new Uint8Array(
        signature.match(/../g)!.map((v: string) => parseInt(v, 16)),
      ),
      new TextEncoder().encode(`${stamp}.${body}`),
    ))
  )
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
