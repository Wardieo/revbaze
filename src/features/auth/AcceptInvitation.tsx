import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Users } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { supabase, signOutFully } from "../../lib/supabase";
import { passwordStrength } from "../../lib/password";
import { authErrorMessage } from "../../lib/auth";
import { queryClient } from "../../lib/queryClient";
import { Password } from "./AuthPage";
export function AcceptInvitation({ session }: { session: Session | null }) {
  const [params] = useSearchParams();
  const invitation = params.get("invitation") || session?.user.user_metadata.workspace_invitation;
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!session || typeof invitation !== "string") return <section><h1>Open your invitation email.</h1><p className="auth-subtitle">Use your secure invitation link to join a workspace. Ask the workspace owner for help if the invitation has expired.</p><Link to="/login" className="text-link">Sign in</Link></section>;
  return <section><span className="auth-status-icon"><Users size={28} /></span><h1>Your team is waiting.</h1><p className="auth-subtitle">Set a password for {session.user.email}, then accept your workspace invitation.</p><form className="stack-form" onSubmit={async event => {
    event.preventDefault(); if (busy || passwordStrength(password) === 1 || password !== confirm) return;
    setBusy(true); setError("");
    try {
      const { error: validationError } = await supabase!.rpc("validate_workspace_invitation", { p_invitation: invitation });
      if (validationError) throw validationError;
      const { error: passwordError } = await supabase!.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      const { data: businessId, error: acceptanceError } = await supabase!.rpc("accept_workspace_invitation", { p_invitation: invitation });
      if (acceptanceError) throw acceptanceError;
      localStorage.setItem(`revbaze-active-business:${session.user.id}`, businessId);
      await queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      navigate("/overview", { replace: true });
    } catch (e) { setError(authErrorMessage(e)); }
    finally { setBusy(false); }
  }}><Password label="New password" value={password} change={setPassword} strength /><Password label="Confirm password" value={confirm} change={setConfirm} mismatch={Boolean(confirm) && password !== confirm} />{error && <p className="auth-notice" role="alert">{error}</p>}<Button variant="primary" disabled={busy || passwordStrength(password) === 1 || password !== confirm}>{busy ? "Joining…" : "Accept invitation"}</Button></form><p className="auth-switch"><Link to="/login" onClick={event => { event.preventDefault(); void signOutFully(); }}>Back to sign in</Link></p></section>;
}
