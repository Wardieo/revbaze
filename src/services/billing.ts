import { supabase } from "../lib/supabase";
export async function billingAction(
  action: "checkout" | "portal" | "status",
  plan?: "growth" | "pro",
  returnTo?: string,
) {
  if (!supabase)
    throw new Error("Sign in to your cloud account to manage billing.");
  const { data, error } = await supabase.functions.invoke("billing", {
    body: {
      action,
      plan,
      returnTo: returnTo || window.location.hash.slice(1) || "/upgrade",
    },
  });
  if (error) {
    let message =
      "Billing is unavailable. Please try again or contact support.";
    if (error.context instanceof Response) {
      try {
        message = (await error.context.json()).error || message;
      } catch {
        /* Keep a readable fallback. */
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as {
    url?: string;
    configured?: boolean;
    hasCustomer?: boolean;
    status?: string;
    cancelAtPeriodEnd?: boolean;
    periodEnd?: string;
  };
}
export async function openBilling(
  action: "checkout" | "portal",
  plan?: "growth" | "pro",
  returnTo?: string,
) {
  const data = await billingAction(action, plan, returnTo);
  const url = new URL(data.url || "");
  const allowed =
    action === "checkout"
      ? ["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)
      : url.hostname === "billing.stripe.com";
  if (!allowed || url.protocol !== "https:")
    throw new Error("Billing returned an invalid destination.");
  window.location.assign(url.href);
}
