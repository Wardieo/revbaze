import { supabase } from "../lib/supabase";
let sessionVisitor = "";
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
  const body = {
    id: crypto.randomUUID(),
    slug,
    type,
    linkId,
    referrer,
    visitorId: visitorId(),
    source: /^[a-z0-9][a-z0-9 _.-]{0,79}$/.test(source) ? source : undefined,
  };
  // Retrying with the same event ID is safe: ingress is idempotent.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await supabase.functions.invoke("review-events", {
        body,
      });
      if (!error) return;
    } catch {
      /* Tracking failure must not interrupt navigation. */
    }
  }
}
