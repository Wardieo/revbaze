import { BrandLogo } from "../shared/BrandLogo";
import { useDowngradeAccess } from "../../hooks/useDowngradeAccess";
import { usePlan } from "../../hooks/usePlan";
import { useEffect, useId, useRef, useState } from "react";
import { supabase, signOutFully } from "../../lib/supabase";
import { useFeedback } from "../../hooks/useFeedback";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  PanelsTopLeft,
  ChartNoAxesCombined,
  Link2,
  Plug,
  Check,
  Plus,
  QrCode,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
} from "lucide-react";
import { useWorkspace } from "../../stores/workspace";
import { usePreferences } from "../../stores/preferences";
const groups = [
  {
    label: "MAIN",
    items: [
      { name: "Overview", icon: LayoutDashboard, path: "/overview" },
      { name: "Review cards", icon: PanelsTopLeft, path: "/cards" },
      { name: "Analytics", icon: ChartNoAxesCombined, path: "/analytics" },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { name: "Review platforms", icon: Link2, path: "/platforms" },
      { name: "QR codes", icon: QrCode, path: "/qr-codes" },
      { name: "Integrations", icon: Plug, path: "/integrations" },
    ],
  },
  {
    label: "WORKSPACE",
    items: [{ name: "Settings", icon: Settings, path: "/settings" }],
  },
];
export function Sidebar({
  close,
  businessLabel,
  businesses = [],
  activeBusinessId,
  onSelectBusiness,
}: {
  close: () => void;
  businessLabel?: string;
  businesses?: { id: string; name: string; logo_url?: string }[];
  activeBusinessId?: string;
  onSelectBusiness?: (id: string) => void;
}) {
  const access = usePlan(null);
  const workspaceAccess = usePlan();
  const usedCards = workspaceAccess.status?.workspace_cards ?? 0;
  const cardLimit = workspaceAccess.plan.cards;
  const availability = useDowngradeAccess();
  const businessLimitReached =
    access.accountPlan.businesses !== null &&
    (access.status?.businesses ?? businesses.length) >=
      access.accountPlan.businesses;
  const business = useWorkspace((s) => s.business);
  const preferences = usePreferences();
  const cardCount = useWorkspace((s) => s.cards.length);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const workspaceButton = useRef<HTMLButtonElement>(null);
  const workspaceListId = useId();
  const [businessLogos, setBusinessLogos] = useState<Record<string, string>>(
    {},
  );
  const baseOptions = businesses.length
    ? businesses
    : business
      ? [{ id: business.id, name: business.name, logo_url: business.logo_url }]
      : [];
  const options = baseOptions.map((item) => ({
    ...item,
    logo_url:
      businessLogos[item.id] ||
      item.logo_url ||
      (business?.id === item.id ? business.logo_url : ""),
  }));
  const businessIds = baseOptions.map((item) => item.id).join(",");
  useEffect(() => {
    if (!workspaceOpen || !supabase || !businessIds) return;
    let active = true;
    supabase
      .from("businesses")
      .select("id,logo_url")
      .in("id", businessIds.split(","))
      .then(({ data, error }) => {
        if (active && !error && data)
          setBusinessLogos(
            Object.fromEntries(
              data.map((item) => [item.id, item.logo_url || ""]),
            ),
          );
      });
    return () => {
      active = false;
    };
  }, [workspaceOpen, businessIds]);
  const currentLogo =
    options.find((b) => b.id === (activeBusinessId || business?.id))
      ?.logo_url ||
    (business?.id === activeBusinessId ? business?.logo_url || "" : "");
  useEffect(() => {
    if (!workspaceOpen) return;
    const click = (event: PointerEvent) => {
      if (!workspaceRef.current?.contains(event.target as Node))
        setWorkspaceOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWorkspaceOpen(false);
        workspaceButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", click);
      document.removeEventListener("keydown", key);
    };
  }, [workspaceOpen]);
  const [accountOpen, setAccountOpen] = useState(false);
  const notify = useFeedback();
  return (
    <aside className="sidebar">
      <div className="brand">
        <BrandLogo />
        <button
          className="collapse-button icon-button"
          aria-label={
            preferences.collapsed ? "Expand sidebar" : "Collapse sidebar"
          }
          onClick={() => preferences.set({ collapsed: !preferences.collapsed })}
        >
          {preferences.collapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={close}
        >
          <PanelLeftClose size={18} />
        </button>
      </div>
      <div className="workspace-switcher" ref={workspaceRef}>
        <button
          ref={workspaceButton}
          type="button"
          className="workspace"
          aria-label="Switch business workspace"
          aria-expanded={workspaceOpen}
          aria-controls={workspaceListId}
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
        >
          {currentLogo ? (
            <img
              className="business-logo"
              src={currentLogo}
              alt="Business logo"
            />
          ) : (
            <span className="workspace-avatar">
              {(businessLabel || business?.name || "Your business")
                .charAt(0)
                .toLowerCase()}
              .
            </span>
          )}
          <span className="workspace-description">
            <strong>
              {businessLabel || business?.name || "Your business"}
            </strong>
          </span>
          <ChevronDown
            size={13}
            className={workspaceOpen ? "workspace-chevron-open" : ""}
          />
        </button>
        {workspaceOpen && (
          <div id={workspaceListId} className="workspace-dropdown">
            <span className="workspace-dropdown-label">Your businesses</span>
            <div className="workspace-options">
              {options.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={item.id === (activeBusinessId || business?.id)}
                  onClick={() => {
                    if (item.id !== (activeBusinessId || business?.id))
                      onSelectBusiness?.(item.id);
                    setWorkspaceOpen(false);
                    close();
                  }}
                >
                  <span className="workspace-option-avatar">
                    {item.logo_url ? (
                      <img src={item.logo_url} alt={`${item.name} logo`} />
                    ) : (
                      item.name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span>
                    {item.name}
                    {availability.data?.businesses.find((b) => b.id === item.id)
                      ?.available === false && (
                      <small className="workspace-paused-label">
                        Paused · plan limit
                      </small>
                    )}
                  </span>
                  {item.id === (activeBusinessId || business?.id) && (
                    <Check size={15} />
                  )}
                </button>
              ))}
              {!options.length && <p>No businesses set up yet.</p>}
            </div>
            <NavLink
              to={businessLimitReached ? "/upgrade" : "/onboarding?new=1"}
              state={businessLimitReached ? undefined : { businessSetup: true }}
              onClick={() => {
                setWorkspaceOpen(false);
                close();
              }}
            >
              <Plus size={14} />
              {businessLimitReached
                ? "Upgrade to add a business"
                : "Add a business"}
            </NavLink>
          </div>
        )}
      </div>

      <nav>
        {groups.map((g) => (
          <div className="nav-group" key={g.label}>
            <span className="nav-label">{g.label}</span>
            {g.items.map(({ name, icon: Icon, path }) => (
              <NavLink
                title={name}
                key={path}
                to={path}
                end={path === "/"}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
                onClick={close}
              >
                <Icon size={18} />
                <span>{name}</span>
                {path === "/cards" && <small>{cardCount}</small>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span className="tiny-dot" />
          One link. Every review platform.
        </div>
        {workspaceAccess.ready && workspaceAccess.plan.id === "growth" && (
          <section className="sidebar-plan-usage" aria-label={`${workspaceAccess.plan.name} review card usage`}>
            <div className="sidebar-plan-count"><strong>{usedCards}<small>{cardLimit === null ? " / Unlimited" : ` / ${cardLimit}`}</small></strong><span>Review cards used</span></div>
            {cardLimit !== null ? <>
              <div className="sidebar-plan-meter" role="progressbar" aria-label="Review cards used" aria-valuenow={usedCards} aria-valuemin={0} aria-valuemax={Math.max(cardLimit, usedCards)}><span style={{ width: `${Math.min(100, usedCards / cardLimit * 100)}%` }} /></div>
              <p>{Math.max(0, cardLimit - usedCards)} cards remaining</p>
            </> : <p>Unlimited card capacity</p>}
          </section>
        )}
        <button
          className="sidebar-profile"
          aria-label="Sidebar account menu"
          aria-expanded={accountOpen}
          onClick={() => setAccountOpen(!accountOpen)}
        >
          {preferences.image ? (
            <img
              className="avatar profile-avatar"
              src={preferences.image}
              alt="Your profile"
            />
          ) : (
            <span className="avatar profile-avatar">
              {preferences.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          )}
          <span>
            <strong>{preferences.name}</strong>
            <small>Settings</small>
          </span>
          <ChevronDown size={13} />
        </button>
        {accountOpen && (
          <>
            <button
              className="menu-dismiss"
              aria-label="Close sidebar account menu"
              onClick={() => setAccountOpen(false)}
            />
            <div className="sidebar-account-menu">
              <strong>{preferences.name}</strong>
              <NavLink
                to="/settings"
                onClick={() => {
                  setAccountOpen(false);
                  close();
                }}
              >
                Settings
              </NavLink>
              <NavLink
                to="/settings?tab=business"
                onClick={() => {
                  setAccountOpen(false);
                  close();
                }}
              >
                Business profile
              </NavLink>
              {supabase ? (
                <button
                  onClick={async () => {
                    const { error } = await signOutFully();
                    if (error) notify(error.message, true);
                    else setAccountOpen(false);
                  }}
                >
                  Sign out
                </button>
              ) : (
                <NavLink
                  to="/login"
                  onClick={() => {
                    setAccountOpen(false);
                    close();
                  }}
                >
                  Sign in / create account
                </NavLink>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
