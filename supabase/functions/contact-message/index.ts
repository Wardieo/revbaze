import { createClient } from "npm:@supabase/supabase-js@2.109.0";

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  const allowed = (Deno.env.get("CONTACT_ALLOWED_ORIGINS") || Deno.env.get("APP_URL") || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
  if (!allowed.length) return reply(503, { error: "Contact service is not configured yet." });
  if (!allowed.includes(origin)) return reply(403, { error: "Request not allowed." });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, { error: "Method not allowed." });
  try {
    // Bound request size while reading, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { error: "Please enter a message." });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16000) { await reader.cancel(); return reply(413, { error: "Message is too large." }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let input;
    try { input = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { return reply(400, { error: "Invalid message." }); }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!input || typeof input !== "object" || typeof input.id !== "string" || !uuid.test(input.id) ||
      typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100 ||
      typeof input.email !== "string" || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
      !["Product question", "Product feedback", "Plans & pricing", "Something else"].includes(input.topic) ||
      typeof input.message !== "string" || input.message.trim().length < 10 || input.message.trim().length > 3000 ||
      (input.website !== undefined && input.website !== ""))
      return reply(400, { error: "Check your details and enter a message of at least 10 characters." });
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // No raw IP addresses are retained in the contact inbox.
    const source = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(source));
    const sourceHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const db = createClient(Deno.env.get("SUPABASE_URL")!, secret, { auth: { persistSession: false } });
    const { error } = await db.rpc("submit_contact_message", {
      p_id: input.id, p_name: input.name.trim(), p_email: input.email.trim(),
      p_topic: input.topic, p_message: input.message.trim(), p_source_hash: sourceHash,
    });
    if (error) {
      if (error.message.includes("Contact submission limit reached"))
        return reply(429, { error: "Too many messages. Please try again in an hour." });
      return reply(503, { error: "We couldn’t save your message. Please try again shortly." });
    }
    return reply(200, { received: true, id: input.id });
  } catch {
    return reply(503, { error: "We couldn’t receive your message. Please try again shortly." });
  }
});
