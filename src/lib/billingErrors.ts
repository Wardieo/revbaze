/** Preserve useful HTTP errors without logging credentials or response bodies. */
export async function billingErrorMessage(error: unknown): Promise<string> {
  const fallback = "Billing is unavailable. Please try again.";
  if (!error || typeof error !== "object") return fallback;
  const failure = error as { name?: string; context?: unknown };
  if (failure.name === "FunctionsFetchError")
    return "Could not reach checkout. Check your connection. If this continues, verify that the billing function is deployed and APP_URL matches this website.";
  if (failure.context instanceof Response) {
    const response = failure.context;
    try {
      const body: unknown = await response.clone().json();
      if (body && typeof body === "object") {
        const value = body as Record<string, unknown>;
        const detail = [value.error, value.message, value.msg].find(
          (entry) => typeof entry === "string" && entry.trim(),
        );
        if (typeof detail === "string") return detail.slice(0, 1000);
      }
    } catch {
      /* Gateways can return empty or non-JSON errors. */
    }
    if (response.status === 401)
      return "Your checkout session could not be verified. Sign in again. If it continues, check the billing function's JWT verification setting.";
    if (response.status === 404)
      return "Checkout is not deployed on this Supabase project. Deploy the billing function and try again.";
    if (response.status === 403)
      return "Checkout is not allowed from this website. Check that the billing APP_URL matches this website's origin.";
    return `Checkout returned HTTP ${response.status}. Check the billing function logs or contact support.`;
  }
  if (failure.name === "FunctionsRelayError")
    return "The billing service could not start. Check the deployed billing function logs.";
  return fallback;
}
