import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  const appURL = Deno.env.get("APP_URL") || "";
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin === appURL ? origin : appURL, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!appURL || origin !== appURL) return respond({ error: "Request origin is not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return respond({ error: "Sign in to invite members" }, 401);
  const { data: identity, error: authError } = await db.auth.getUser(token);
  if (authError || !identity.user) return respond({ error: "Sign in to invite members" }, 401);
  let invitation: string | undefined;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return respond({ error: "Request is too large" }, 413);
    const input = JSON.parse(raw);
    if (typeof input.email !== "string" || typeof input.business_id !== "string" || !["admin", "editor", "viewer"].includes(input.role)) return respond({ error: "Provide a business, email, and valid role" }, 400);
    if (input.all_businesses !== undefined && typeof input.all_businesses !== "boolean") return respond({ error: "Invalid business access selection" }, 400);
    const { data: id, error } = await db.rpc("reserve_scoped_workspace_invitation", { p_actor: identity.user.id, p_business: input.business_id, p_email: input.email, p_role: input.role, p_all_businesses: input.all_businesses === true });
    if (error) return respond({ error: error.message }, 400);
    invitation = id;
    const { data: reservation, error: readError } = await db.from("workspace_invitations").select("invited_user_id").eq("id", id).single();
    if (readError || !reservation) throw new Error("Unable to read invitation reservation");
    const recipientEmail = input.email.trim().toLowerCase();
    const redirectTo = `${appURL}/?auth_callback=invite&invitation=${id}`;
    if (reservation.invited_user_id) {
      // A verified invited user cannot receive another Auth invite. Send a fresh
      // sign-in link; membership still requires this private, verified reservation.
      const { error: metadataError } = await db.auth.admin.updateUserById(reservation.invited_user_id, { user_metadata: { workspace_invitation: id } });
      if (metadataError) throw metadataError;
      const { error: sendError } = await db.auth.signInWithOtp({ email: recipientEmail, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
      if (sendError) throw sendError;
      return respond({ success: true, resent: true });
    }
    const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(recipientEmail, { redirectTo, data: { workspace_invitation: id } });
    if (inviteError || !invited.user) throw new Error(inviteError?.message || "Unable to send invitation");
    const { error: bindError } = await db.from("workspace_invitations").update({ invited_user_id: invited.user.id }).eq("id", id).eq("status", "pending");
    if (bindError) throw new Error("The invitation could not be confirmed. Please revoke it and contact support.");
    return respond({ success: true });
  } catch (error) {
    if (invitation) await db.from("workspace_invitations").update({ status: "failed" }).eq("id", invitation).eq("status", "pending");
    return respond({ error: error instanceof Error ? error.message : "Unable to send invitation" }, 400);
  }
});
