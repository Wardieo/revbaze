import { supabase } from "../lib/supabase";
let sessionVisitor = "";
const sessions = new Map<string, { token: string; expires: number }>();
const pendingSessions = new Map<string, Promise<string | null>>();
async function trackingToken(
  slug: string,
  visitor: string,
): Promise<string | null> {
  const cacheKey = `${slug}:${visitor}`;
  const existing = sessions.get(cacheKey);
  if (existing && existing.expires > Date.now() + 30_000) return existing.token;
  const pending = pendingSessions.get(cacheKey);
  if (pending) return pending;
  const request = (async () => {
    try {
      const { data, error } = await supabase!.functions.invoke(
        "review-events",
        { body: { action: "session", slug, visitorId: visitor } },
      );
      if (error || typeof data?.token !== "string") return null;
      sessions.set(cacheKey, data);
      return data.token as string;
    } catch {
      return null;
    } finally {
      pendingSessions.delete(cacheKey);
    }
  })();
  pendingSessions.set(cacheKey, request);
  return request;
}
function visitorId() {
  try {
    const stored = localStorage.getItem("revbaze-anonymous-visitor");
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
    const id = (sessionVisitor ||= crypto.randomUUID());
    localStorage.setItem("revbaze-anonymous-visitor", id);
    return id;
  } catch {
    return (sessionVisitor ||= crypto.randomUUID());
  }
}
export async function recordReviewEvent(
  slug: string,
  type: "page_view" | "outbound_click",
  linkId?: string,
) {
  if (!supabase) return;
  const hashQuery = new URLSearchParams(
    window.location.hash.split("?")[1] || "",
  );
  const source = (
    hashQuery.get("utm_source") ||
    new URLSearchParams(window.location.search).get("utm_source") ||
    ""
  )
    .toLowerCase()
    .trim();
  let referrer = document.referrer;
  try {
    if (new URL(referrer).origin === window.location.origin) referrer = "";
  } catch {
    referrer = "";
  }
  const visitor = visitorId();
  const token = await trackingToken(slug, visitor);
  if (!token) return;
  const body = {
    token,
    id: crypto.randomUUID(),
    slug,
    type,
    linkId,
    referrer,
    visitorId: visitor,
    source: /^[a-z0-9][a-z0-9 _.-]{0,79}$/.test(source) ? source : undefined,
  };
  // Retrying with the same event ID is safe: ingress is idempotent.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await supabase.functions.invoke("review-events", {
        body,
      });
      if (!error) return;
      const status = error.context?.status;
      if (status && status < 500) {
        if (status === 403) sessions.delete(`${slug}:${visitor}`);
        return;
      }
      if (attempt === 0)
        await new Promise((resolve) => setTimeout(resolve, 500));
    } catch {
      /* Tracking failure must not interrupt navigation. */
    }
  }
}
