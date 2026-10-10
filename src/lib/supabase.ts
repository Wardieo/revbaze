import { createClient } from "@supabase/supabase-js";
import { callbackDetails } from "./auth";
import { createAuthFetch } from "./authFetch";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, { global: { fetch: createAuthFetch(url) } })
    : null;
// Reload after logout so no cached React state or SDK session survives navigation.
export async function signOutFully(): Promise<{ error: { message: string } | null }> {
  if (!supabase) return { error: null };
  try {
    const { error } = await supabase.auth.signOut();
    if (error) console.warn("Remote sign-out could not complete; clearing this browser session.");
  } catch {
    console.warn("Remote sign-out could not complete; clearing this browser session.");
  } finally {
    clearPasswordRecovery();
    const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem(storageKey);
      store.removeItem(`${storageKey}-code-verifier`);
      store.removeItem(`${storageKey}-user`);
    }
    window.location.replace(window.location.pathname + "#/login");
  }
  return { error: null };
}
export const authCallback = callbackDetails(window.location.href);
// A normal signed-in session or a recovery query parameter is not sufficient.
// Only the SDK's verified email recovery event opens this short-lived form.
let recoveryUser: string | null = null;
let recoveryExpiresAt = 0;
const recoveryRestrictionKey = "revbaze-password-recovery-user";
export function isPasswordRecoverySession(userId: string | undefined) {
  if (!userId) return false;
  if (recoveryUser === userId) return true;
  try {
    return localStorage.getItem(recoveryRestrictionKey) === userId;
  } catch {
    return false;
  }
}
supabase?.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" && authCallback.active && authCallback.recovery && session) {
    recoveryUser = session.user.id;
    recoveryExpiresAt = Date.now() + 15 * 60_000;
    try {
      localStorage.setItem(recoveryRestrictionKey, session.user.id);
    } catch {
      /* This page still restricts the recovery session in memory. */
    }
  } else if (event === "SIGNED_OUT") {
    clearPasswordRecovery();
  }
});
export function canResetPassword(userId: string | undefined) {
  return Boolean(userId && userId === recoveryUser && Date.now() < recoveryExpiresAt);
}
export function clearPasswordRecovery() {
  recoveryUser = null;
  recoveryExpiresAt = 0;
  try {
    localStorage.removeItem(recoveryRestrictionKey);
  } catch {
    /* Storage may be unavailable. */
  }
}
// Let the SDK consume email tokens before HashRouter takes over the URL fragment.
export const authBootstrap = supabase
  ? supabase.auth.getSession().then(async (result) => {
      if (authCallback.active) {
        // The SDK dispatches the recovery event on the next task after verifying
        // the link. Let it complete before choosing the callback destination.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        if (result.error && !authCallback.error)
          authCallback.error = result.error.message;
        const inviteId = new URL(window.location.href).searchParams.get("invitation");
        const target = inviteId && result.data.session && !authCallback.error
          ? `/accept-invitation?invitation=${encodeURIComponent(inviteId)}`
          : canResetPassword(result.data.session?.user.id) && !authCallback.error
            ? "/reset-password"
            : "/auth/callback";
        window.history.replaceState(
          null,
          "",
          window.location.pathname + "#" + target,
        );
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }
      return result;
    })
  : Promise.resolve(null);
