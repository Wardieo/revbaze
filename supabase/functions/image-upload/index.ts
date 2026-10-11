import { createClient } from "npm:@supabase/supabase-js@2.109.0";
import { boundedBody } from "../_shared/tracking.ts";
import { validateImageBytes } from "../_shared/image-validation.ts";
Deno.serve(async (request: Request) => {
  const origin = Deno.env.get("APP_URL") || "";
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-business-id, x-image-bucket",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
  const reply = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), { status, headers });
  if (!origin || request.headers.get("origin") !== origin)
    return reply(403, { error: "Request origin is not allowed" });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return reply(405, { error: "Method not allowed" });
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Sign in to upload an image" });
  const identity = await db.auth.getUser(token);
  if (identity.error || !identity.data.user)
    return reply(401, { error: "Your session expired" });
  try {
    const mime = request.headers.get("content-type")?.split(";")[0] || "";
    const bytes = await boundedBody(request, 524288);
    validateImageBytes(bytes, mime);
    const bucket = request.headers.get("x-image-bucket") || "";
    const business = request.headers.get("x-business-id") || null;
    const id = crypto.randomUUID();
    const reservation = await db.rpc("reserve_image_upload", {
      p_actor: identity.data.user.id,
      p_business: business,
      p_bucket: bucket,
      p_id: id,
      p_bytes: bytes.byteLength,
      p_extension: mime === "image/png" ? "png" : "jpeg",
    });
    if (reservation.error)
      return reply(
        reservation.error.message.includes("rate limit") ? 429 : 400,
        { error: reservation.error.message },
      );
    const upload = await db.storage
      .from(bucket)
      .upload(reservation.data, bytes, { contentType: mime, upsert: false });
    if (upload.error)
      return reply(503, {
        error: "Image upload failed. Please try again later",
      });
    const completed = await db.rpc("complete_image_upload", { p_id: id });
    if (completed.error)
      return reply(503, { error: "Unable to complete image upload" });
    return reply(200, {
      url: db.storage.from(bucket).getPublicUrl(reservation.data).data
        .publicUrl,
    });
  } catch (error) {
    return reply(
      error instanceof Error && error.message === "Body too large" ? 413 : 400,
      { error: error instanceof Error ? error.message : "Invalid image" },
    );
  }
});
