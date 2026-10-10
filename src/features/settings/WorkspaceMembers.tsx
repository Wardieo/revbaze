import { useSession } from "../../hooks/useSession";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Mail, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../stores/workspace";
import { Button } from "../../components/ui/Button";
import "./members.css";
type Role = "admin" | "editor" | "viewer";
export type MemberRoster = { role: Role | "owner"; limit: number; used: number; businesses: { id: string; name: string }[]; members: { user_id: string; email: string; role: Role | "owner"; active: boolean }[]; invitations: { id: string; email: string; role: Role; expires_at: string; resend_available_at?: string; all_businesses?: boolean }[] };
export function WorkspaceMembers() {
  const { session } = useSession();
  const business = useWorkspace(s => s.business);
  const client = useQueryClient();
  const [selection, setSelection] = useState<{ accountBusiness: string; target: string } | null>(null);
  const selectedId = selection && selection.accountBusiness === business?.id ? selection.target : business?.id;
  const [inviteAll, setInviteAll] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [now, setNow] = useState(Date.now);
  const [sentUntil, setSentUntil] = useState<Record<string, number>>({});
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  function resendSeconds(invite: MemberRoster["invitations"][number]) {
    const deadline = Math.max(sentUntil[invite.email.toLowerCase()] ?? 0, invite.resend_available_at ? Date.parse(invite.resend_available_at) : 0);
    return Math.max(0, Math.ceil((deadline - now) / 1000));
  }
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["workspace-members", selectedId, session?.user.id], enabled: Boolean(supabase && selectedId), refetchInterval: 5000, queryFn: async () => {
    const { data, error } = await supabase!.rpc("workspace_members", { p_business: selectedId });
    if (error) throw new Error(error.message);
    return data as MemberRoster;
  } });
  async function action(args: Record<string, unknown>) {
    if (!business || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { error } = await supabase!.rpc("manage_workspace_member", { p_business: selectedId, ...args });
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ["workspace-members"] });
      setMessage("Workspace access updated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update workspace access."); }
    finally { setBusy(false); }
  }
  async function sendInvite(inviteEmail: string, inviteRole: Role, allBusinesses: boolean) {
        if (busy) return; setBusy(true); setError(""); setMessage("");
        try {
          const { data: result, error: invokeError } = await supabase!.functions.invoke("workspace-invite", { body: { business_id: selectedId, email: inviteEmail.trim(), role: inviteRole, all_businesses: allBusinesses } });
          if (invokeError) {
            let text = "Unable to send invitation.";
            if (invokeError.context instanceof Response) { try { text = (await invokeError.context.json()).error || text; } catch { /* Use fallback. */ } }
            throw new Error(text);
          }
          if (!result?.success) throw new Error(result?.error || "Unable to send invitation.");
          const deadline = Date.now() + 60_000;
          setSentUntil(previous => ({ ...previous, [inviteEmail.trim().toLowerCase()]: deadline }));
          setNow(Date.now());
          setEmail(""); setMessage(result.resent ? "Invitation resent. Use the newest email link to finish joining." : "Invitation sent. They’ll receive a secure link to join your workspace.");
          await query.refetch();
        } catch (e) { setError(e instanceof Error ? e.message : "Unable to send invitation."); }
        finally { setBusy(false); }
  }
  const data = query.data;
  const owner = data?.role === "owner";
  const seats = data?.used ?? 0;
  const selectedName = data?.businesses?.find(b => b.id === selectedId)?.name ?? business?.name;
  if (!business) return <section className="card padded"><h2>Members</h2><p>Select a business workspace first.</p></section>;
  return <section className="card padded workspace-members">
    <header className="members-heading"><div className="members-hero-copy"><span className="members-eyebrow"><Users size={16} /> YOUR WORKSPACE TEAM</span><h2>Better, together.</h2><p className="section-description">One team, the right access. Your member seats are shared across all your businesses.</p></div><div className="members-seat-count"><span>ACCOUNT CAPACITY</span><strong>{owner ? seats : "—"} <small>/ {data?.limit ?? "…"}</small></strong><span>invited member seats</span><div className="members-seat-track"><i style={{ width: `${Math.min(100, data?.limit ? seats / data.limit * 100 : 0)}%` }} /></div></div></header>
    {query.isPending && <p role="status">Loading your team…</p>}
    {(error || query.error) && <p className="form-error" role="alert">{error || query.error?.message}</p>}
    {message && <p className="form-help" role="status">{message}</p>}
    {data && <>
      <div className="members-section-heading"><div><h3>Access, with intention.</h3><p>Choose a role that fits how each person works.</p></div></div><div className="members-role-guide"> <span><strong>Admin</strong> Business settings, cards, and platforms</span><span><strong>Editor</strong> Cards and platforms</span><span><strong>Viewer</strong> Dashboard and analytics</span></div>
      {owner ? data.limit > 0 ? <form className="members-invite-form" onSubmit={async e => {
        e.preventDefault(); await sendInvite(email, role, inviteAll);
      }}>
        <label>Business access<select aria-label="Business access" disabled={busy} value={inviteAll ? "all" : selectedId} onChange={e => { setInviteAll(e.target.value === "all"); if (e.target.value === "all") return; setSelection({ accountBusiness: business.id, target: e.target.value }); setError(""); setMessage(""); }}><option value="all">All businesses</option>{(data.businesses ?? [{ id: business.id, name: business.name }]).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label>New member’s email<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@example.com" /></label>
        <label>Role<select value={role} onChange={e => setRole(e.target.value as Role)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label>
        <Button variant="primary" disabled={busy || (seats >= data.limit && !data.invitations.some(i => i.email.toLowerCase() === email.trim().toLowerCase()))}><Mail size={16} />{busy ? "Sending…" : "Send invitation"}</Button>
        <small>{inviteAll ? "Access includes all your current businesses. Businesses added later are not included." : "Access is limited to the selected business."} Existing accounts cannot be invited. You can resend an unfinished invitation until the recipient accepts and joins your team. Pending invitations reserve an account seat for seven days.</small>
      </form> : <p className="members-plan-note">Free workspaces are owner-only. Growth includes 5 member seats across all businesses; Pro includes 20. Saved memberships resume when the workspace’s plan has capacity.</p> : <p className="form-help">Only the owner can invite people or change their access. Your role: {data.role}.</p>}
      <div className="members-section-heading"><div><h3>{selectedName} team</h3><p>Members and invitations for this business.</p></div><span className="members-role-badge">{data.members.length} members</span></div><div className="members-list">{data.members.map(member => <div className="members-row" key={member.user_id}><span className="members-avatar">{member.email.slice(0, 1).toUpperCase()}</span><div><strong>{member.email}</strong><small>{member.active ? "Workspace access active" : "Paused by plan limits"}</small></div>{owner && member.role !== "owner" ? <><select aria-label={`Role for ${member.email}`} disabled={busy} value={member.role} onChange={e => void action({ p_user: member.user_id, p_role: e.target.value })}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select><Button disabled={busy} aria-label={`Remove ${member.email}`} onClick={() => { if (window.confirm(`Remove workspace access for ${member.email}?`)) void action({ p_user: member.user_id }); }}><Trash2 size={16} /></Button></> : <span className="members-role-badge">{member.role}</span>}</div>)}
        {data.invitations.map(invite => <div className="members-row" key={invite.id}><span className="members-avatar"><Mail size={18} /></span><div><strong>{invite.email}</strong><small>Pending · {invite.all_businesses ? "All businesses · " : ""}{invite.role} · expires {new Date(invite.expires_at).toLocaleDateString()}</small></div><Button disabled={busy || resendSeconds(invite) > 0} onClick={() => void sendInvite(invite.email, invite.role, Boolean(invite.all_businesses))}>{resendSeconds(invite) > 0 ? `Sent · ${Math.floor(resendSeconds(invite) / 60)}:${String(resendSeconds(invite) % 60).padStart(2, "0")}` : "Resend"}</Button><Button disabled={busy} onClick={() => void action({ p_invitation: invite.id })}>Revoke</Button></div>)}
      </div>
    </>}
  </section>;
}
