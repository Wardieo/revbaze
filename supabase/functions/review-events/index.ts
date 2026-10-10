import { createClient } from "npm:@supabase/supabase-js@2.109.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers });
  try {
    const text = await request.text();
    if (text.length > 2048) return new Response(null, { status: 413, headers });
    const input = JSON.parse(text);
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      typeof input.slug !== "string" ||
      input.slug.length > 60 ||
      !uuid.test(input.id) ||
      !["page_view", "outbound_click"].includes(input.type) ||
      (input.type === "outbound_click" && !uuid.test(input.linkId))
    )
      return new Response(null, { status: 400, headers });
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    // Only the published public projection can authorize tracking; never accept a browser-supplied card ID.
    const published = await db.rpc("published_review_card", {
      p_slug: input.slug,
    });
    const card = published.data;
    if (
      published.error ||
      !card ||
      (input.type === "outbound_click" &&
        !card.destinations.some(
          (link: { id: string }) => link.id === input.linkId,
        ))
    )
      return new Response(null, { status: 404, headers });
    let referrer: string | null = null;
    if (typeof input.referrer === "string") {
      try {
        const url = new URL(input.referrer);
        if (["http:", "https:"].includes(url.protocol))
          referrer = url.hostname.slice(0, 253);
      } catch {
        /* Discard invalid referrers. */
      }
    }
    let visitorKey: string | null = null;
    if (typeof input.visitorId === "string" && uuid.test(input.visitorId)) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const business = await db
        .from("review_cards")
        .select("business_id")
        .eq("id", card.id)
        .single();
      if (business.error || !business.data)
        return new Response(null, { status: 503, headers });
      const hash = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(`${business.data.business_id}:${input.visitorId}`),
      );
      visitorKey = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    }
    const source =
      typeof input.source === "string" &&
      /^[a-z0-9][a-z0-9 _.-]{0,79}$/.test(input.source)
        ? input.source
        : null;
    const { error } = await db.rpc("ingest_visitor_event", {
      p_id: input.id,
      p_card_id: card.id,
      p_type: input.type,
      p_link_id: input.type === "outbound_click" ? input.linkId : null,
      p_referrer: referrer,
      p_visitor_key: visitorKey,
      p_source: source,
    });
    if (error)
      return new Response(
        JSON.stringify({ error: "Tracking temporarily unavailable" }),
        { status: error.message.includes("rate limit") ? 429 : 503, headers },
      );
    return new Response(JSON.stringify({ recorded: true }), { headers });
  } catch {
    return new Response(null, { status: 400, headers });
  }
});
