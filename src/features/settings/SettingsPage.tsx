import { usePlan } from "../../hooks/usePlan";
import { useWorkspaceRole } from "../../hooks/useWorkspaceRole";
import { BrandLogo } from "../../components/shared/BrandLogo";
import { WorkspaceMembers } from "./WorkspaceMembers";
import { BillingSettings } from "../billing/BillingSettings";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Users,
  Building2,
  ShieldCheck,
  Palette,
  Bell,
  CreditCard,
  Download,
  LogOut,
} from "lucide-react";
import { AccountPreferences } from "./AccountPreferences";
import { BusinessForm } from "../business/BusinessPage";
import { Button } from "../../components/ui/Button";
import { supabase, signOutFully } from "../../lib/supabase";
import { authErrorMessage, confirmationRedirect } from "../../lib/auth";
import { useSession } from "../../hooks/useSession";
import { useFeedback } from "../../hooks/useFeedback";
import { useWorkspace } from "../../stores/workspace";
import { usePreferences } from "../../stores/preferences";
import "./settings.css";
const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "business", label: "Business", icon: Building2 },
  { id: "members", label: "Members", icon: Users },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "preferences", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "billing", label: "Plans & billing", icon: CreditCard },
  { id: "data", label: "Your data", icon: Download },
];
export function SettingsPage() {
  const workspaceRole = useWorkspaceRole();
  const workspaceAccess = usePlan();
  const preferences = usePreferences();
  const [params, setParams] = useSearchParams();
  const tab = tabs.some((t) => t.id === params.get("tab"))
    ? params.get("tab")!
    : "profile";
  return (
    <div className="account-settings">
      <header className="settings-header">
        <Link
          to="/overview"
          className="settings-brand"
          aria-label="Revbaze dashboard"
        >
          <BrandLogo />
        </Link>
        <Button asChild>
          <Link to="/overview">
            <ArrowLeft size={15} />
            Back to dashboard
          </Link>
        </Button>
      </header>
      <div className="settings-layout">
        <aside className="settings-navigation">
          <h1>Settings</h1>
          <div className="settings-identity">
            {preferences.image ? (
              <img src={preferences.image} alt="Your profile" />
            ) : (
              <span>{preferences.name.slice(0, 2).toUpperCase()}</span>
            )}
            <div>
              <strong>{preferences.name}</strong>
              <small>{preferences.email || "Business workspace"}</small>
            </div>
          </div>
          <nav className="account-tabs" aria-label="Settings sections">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => setParams({ tab: id })}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="account-panel">
          {tab === "profile" ||
          tab === "preferences" ||
          tab === "notifications" ? (
            <AccountPreferences tab={tab} />
          ) : tab === "business" ? (
            <section className="card padded">
              <h2>Business details</h2>
              <p className="section-description">
                Manage your business identity, contact information, and
                branding.
              </p>
              <BusinessForm />
            </section>
          ) : tab === "members" ? (
            <WorkspaceMembers />
          ) : tab === "security" ? (
            <SecuritySettings />
          ) : tab === "billing" ? (
            workspaceRole.isOwner ? <BillingSettings /> : <section className="card padded"><h2>{workspaceAccess.ready ? `${workspaceAccess.plan.name} workspace plan` : "Workspace plan"}</h2><p>Your access is included in the owner’s subscription, subject to your assigned role.</p><p>The workspace owner manages this business’s subscription. Your workspace access follows their plan.</p></section>
          ) : (
            <DataSettings />
          )}
        </div>
      </div>
    </div>
  );
}
function savedResetDeadline(key: string) {
    try {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

function SecuritySettings() {
  const notify = useFeedback();
  const { session } = useSession();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const cooldownKey = `revbaze-password-reset-cooldown:${session?.user.id || ""}`;
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const sync = () => {
      setDeadline(savedResetDeadline(cooldownKey));
      setNow(Date.now());
    };
    sync();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const onStorage = (event: StorageEvent) => {
      if (event.key === cooldownKey) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, [cooldownKey]);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <div className="account-security">
      <section className="card padded">
        <h2>Password & sign-in</h2>
        <p className="section-description">
          We’ll send a secure link to your account email. Open it to choose a new password.
        </p>
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabase || !session?.user.email || busy || sending.current) return;
            const currentDeadline = Math.max(deadline, savedResetDeadline(cooldownKey));
            if (Date.now() < currentDeadline) {
              setDeadline(currentDeadline);
              setNow(Date.now());
              return;
            }
            sending.current = true;
            setBusy(true);
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
                redirectTo: confirmationRedirect(window.location.origin, window.location.pathname, true),
              });
              if (error) throw error;
              setSent(true);
              const nextDeadline = Date.now() + 60_000;
              setDeadline(nextDeadline);
              setNow(Date.now());
              try {
                localStorage.setItem(cooldownKey, String(nextDeadline));
              } catch {
                /* Keep the in-memory countdown if storage is unavailable. */
              }
              notify("Password reset email requested. Check your inbox and spam folder.");
            } catch (err) {
              notify(
                authErrorMessage(err),
                true,
              );
            } finally {
              sending.current = false;
              setBusy(false);
            }
          }}
        >
          <label>
            Account email
            <input type="email" value={session?.user.email || ""} readOnly />
          </label>
          {sent && (
            <p className="form-help" role="status">
              Check your inbox and spam folder for the reset link. Your password stays the same until you open the link and save a new one.
            </p>
          )}
          <Button variant="primary" disabled={!supabase || !session?.user.email || busy || remaining > 0}>
            {busy ? "Sending…" : remaining > 0 ? `Resend in ${countdown}` : "Send password reset email"}
          </Button>
        </form>
        {!supabase && (
          <p className="form-help">
            Password changes require cloud authentication.
          </p>
        )}
      </section>
      <section className="card padded">
        <h2>Sessions</h2>
        <p className="section-description">
          Manage access to your account across devices.
        </p>
        <div className="account-session-actions">
          <Button
            disabled={!supabase || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { error } = await supabase!.auth.signOut({
                  scope: "others",
                });
                if (error) throw error;
                notify("Other sessions signed out.");
              } catch (err) {
                notify(
                  err instanceof Error
                    ? err.message
                    : "Unable to end sessions.",
                  true,
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Sign out other devices
          </Button>
          <Button
            disabled={!supabase || busy}
            onClick={async () => {
              const { error } = await signOutFully();
              if (error) notify(error.message, true);
            }}
          >
            <LogOut size={14} />
            Sign out
          </Button>
        </div>
      </section>
    </div>
  );
}
function DataSettings() {
  const workspace = useWorkspace();
  const notify = useFeedback();
  return (
    <section className="card padded">
      <h2>Your workspace data</h2>
      <p className="section-description">
        Download your business, review cards, platform links, and the activity
        currently loaded in this workspace.
      </p>
      <Button
        onClick={() => {
          const data = {
            exported_at: new Date().toISOString(),
            business: workspace.business,
            cards: workspace.cards,
            links: workspace.links,
            events: workspace.events,
            activity: workspace.activity,
          };
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(data, null, 2)], {
              type: "application/json",
            }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "revbaze-workspace.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          notify("Workspace export downloaded.");
        }}
      >
        <Download size={14} />
        Download workspace data
      </Button>
      <p className="form-help" style={{ marginTop: 18 }}>
        This export includes the current workspace only. Browser-saved display
        preferences and QR designs stay on this device.
      </p>
    </section>
  );
}
