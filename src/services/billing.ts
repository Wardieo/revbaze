import { supabase } from "../lib/supabase";
export type PaymentSetup = {
  purpose?: "subscription" | "payment-method";
  intentId: string;
  clientKey: string;
  publicKey: string;
  amount: number;
  currency: string;
  methods: string[];
  returnUrl: string;
  userId?: string;
};
export async function billingAction(
  action: "checkout" | "status" | "cancel" | "payment-method",
  plan?: "growth" | "pro",
  returnTo?: string,
) {
  if (!supabase) throw new Error("Sign in to manage billing");
  const { data, error } = await supabase.functions.invoke("billing", {
    body: {
      action,
      plan,
      returnTo: returnTo || window.location.hash.slice(1) || "/upgrade",
    },
  });
  if (error) {
    let message = "Billing is unavailable. Please try again.";
    if (error.context instanceof Response) {
      try {
        message = (await error.context.json()).error || message;
      } catch {
        /* use fallback */
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as {
    payment?: PaymentSetup;
    scheduled?: boolean;
    cancelled?: boolean;
    configured?: boolean;
    hasCustomer?: boolean;
    status?: string;
    cancelAtPeriodEnd?: boolean;
    periodEnd?: string;
  };
}
export async function openBilling(
  action: "checkout" | "portal" | "payment-method",
  plan?: "growth" | "pro",
  returnTo?: string,
) {
  if (action === "portal") {
    window.location.hash = "/settings?tab=billing";
    return;
  }
  const data = await billingAction(action, plan, returnTo);
  if (data.scheduled) {
    window.location.hash = "/settings?tab=billing&scheduled=1";
    return;
  }
  if (!data.payment || !supabase) throw new Error("Payment setup unavailable");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in again");
  sessionStorage.setItem(
    `revbaze-payment:${auth.user.id}`,
    JSON.stringify({ ...data.payment, userId: auth.user.id }),
  );
  window.location.hash = "/pay";
}
