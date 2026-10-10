export function authErrorMessage(error: unknown): string {
  const value =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const code = typeof value.code === "string" ? value.code : "";
  const raw =
    typeof error === "string"
      ? error
      : typeof value.message === "string"
        ? value.message
        : "";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(raw))
    return "Confirm your email before signing in. You can request another confirmation link below.";
  if (code === "over_email_send_rate_limit" || /rate limit/i.test(raw))
    return "Too many email requests. Please wait a few minutes before trying again.";
  if (
    code === "email_address_not_authorized" ||
    /email address.*not authorized/i.test(raw)
  )
    return "Email delivery is restricted by this project's mail settings. The workspace administrator needs to configure Supabase SMTP before new customers can register.";
  if (/sending confirmation|sending recovery|smtp/i.test(raw))
    return "The email provider could not send your link. Please try again later. The workspace administrator should check Supabase Auth logs and SMTP settings.";
  if (/database error/i.test(raw))
    return "Supabase could not save the account. Check Auth and Postgres logs for a failing auth.users trigger, missing table, or database constraint.";
  if (code === "unexpected_failure")
    return "The authentication server failed to complete the request. Check Supabase Auth logs for the underlying error.";
  if (code === "invalid_credentials")
    return "The email or password is incorrect.";
  if (/fetch|network/i.test(raw))
    return "We couldn't reach the sign-in service. Check your connection and try again.";
  if (!raw.trim() || raw.trim() === "{}" || raw === "[object Object]")
    return "The authentication service returned an unexpected response. Please try again. If it continues, check Supabase Auth logs and email settings.";
  return raw;
}
export function confirmationRedirect(
  origin: string,
  pathname: string,
  recovery = false,
): string {
  const url = new URL(pathname, origin);
  url.searchParams.set("auth_callback", recovery ? "recovery" : "signup");
  return url.toString();
}
export function callbackDetails(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const active =
    url.searchParams.has("auth_callback") ||
    hash.has("access_token") ||
    hash.has("error_description");
  return {
    active,
    recovery:
      url.searchParams.get("auth_callback") === "recovery" ||
      hash.get("type") === "recovery",
    error:
      hash.get("error_description") ||
      url.searchParams.get("error_description") ||
      "",
  };
}
