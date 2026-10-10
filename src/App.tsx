import { AcceptInvitation } from "./features/auth/AcceptInvitation";
import { pageTitle } from "./lib/pageTitle";
import { queryClient as client } from "./lib/queryClient";
import { PlanGate } from "./components/shared/PlanGate";
import { BusinessSwitchScreen } from "./components/layout/BusinessSwitchScreen";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  HashRouter,
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  PanelLeft,
  ChevronDown,
  LogOut,
  ArrowUpRight,
  CircleHelp,
  Plus,
} from "lucide-react";
import { WorkspaceSearch } from "./components/search/WorkspaceSearch";
import { Sidebar } from "./components/layout/Sidebar";
import { FeedbackProvider, Skeleton } from "./components/shared/Feedback";
import { Button } from "./components/ui/Button";
import { savedBusiness, rememberBusiness } from "./lib/businessSelection";
import { useWorkspace } from "./stores/workspace";
import { usePreferences } from "./stores/preferences";
import { useLiveWorkspace } from "./hooks/useLiveWorkspace";
import { useSession } from "./hooks/useSession";
import { loadWorkspace } from "./services/workspace";
import { emptyWorkspace } from "./types/workspace";
import { supabase, authBootstrap, authCallback, signOutFully, isPasswordRecoverySession } from "./lib/supabase";
import { loadOnboardingStatus } from "./services/onboarding";
import { PublicReviewPage } from "./features/public-review/PublicReviewPage";
import { OverviewPage } from "./features/overview/OverviewPage";
import { CardsPage } from "./features/review-cards/CardsPage";
import { PlatformsPage } from "./features/review-platforms/PlatformsPage";
import { IntegrationsPage } from "./features/integrations/IntegrationsPage";
import { SignupCheckout } from "./features/billing/SignupCheckout";
import { usePlan } from "./hooks/usePlan";
import { CheckoutReturn } from "./features/billing/CheckoutReturn";
import { PlanChooser } from "./features/billing/PlanChooser";
import { SettingsPage } from "./features/settings/SettingsPage";
import { AuthLayout } from "./components/auth/AuthLayout";
import {
  AuthPage,
  ResetPasswordPage,
  CheckEmailPage,
  ForgotPasswordPage,
  AuthCallbackPage,
} from "./features/auth/AuthPage";
import "./App.css";
import "./modern.css";
import "./features/onboarding/onboarding.css";
const CardEditor = lazy(() =>
  import("./features/review-cards/CardEditor").then((m) => ({
    default: m.CardEditor,
  })),
);
const QRCodesPage = lazy(() =>
  import("./features/qr-codes/QRCodesPage").then((m) => ({
    default: m.QRCodesPage,
  })),
);
const OnboardingPage = lazy(() =>
  import("./features/onboarding/OnboardingPage").then((m) => ({
    default: m.OnboardingPage,
  })),
);
const MarketingSite = lazy(() => import("./features/marketing/MarketingSite"));
const AnalyticsPage = lazy(() =>
  import("./features/analytics/AnalyticsPage").then((m) => ({
    default: m.AnalyticsPage,
  })),
);
function Workspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, ready } = useSession();
  const signupAccess = usePlan(null);
  const preferences = usePreferences();
  const [routeUi, setRouteUi] = useState({
    path: location.pathname,
    mobile: false,
    account: false,
    search: "",
  });
  const currentUi =
    routeUi.path === location.pathname
      ? routeUi
      : { path: location.pathname, mobile: false, account: false, search: "" };
  const { mobile, account } = currentUi;
  const setMobile = (mobile: boolean) => setRouteUi({ ...currentUi, mobile });
  const setAccount = (account: boolean) =>
    setRouteUi({ ...currentUi, account });
  const [systemDark, setSystemDark] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const business = useWorkspace((s) => s.business);
  const isPublic = location.pathname.startsWith("/review/");
  const isAuth = [
    "/login",
    "/signup",
    "/check-email",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/accept-invitation",
  ].includes(location.pathname);
  const status = useQuery({
    queryKey: ["onboarding-status", session?.user.id, location.pathname],
    queryFn: loadOnboardingStatus,
    enabled: ready && Boolean(supabase && session) && !isAuth && !isPublic,
    staleTime: 0,
    retry: false,
  });
  const [switching, setSwitching] = useState<{
    userId: string;
    id: string;
    name: string;
    logo: string;
    error: string;
  } | null>(null);
  const switchRequest = useRef(0);
  useEffect(() => {
    switchRequest.current++;
  }, [session?.user.id]);
  const [businessChoice, setBusinessChoice] = useState({ userId: "", id: "" });
  const preferredBusiness =
    businessChoice.userId === session?.user.id
      ? businessChoice.id || savedBusiness(session?.user.id)
      : savedBusiness(session?.user.id);
  const selected = status.data?.businesses.find(
    (b) => b.id === preferredBusiness && b.complete,
  );
  const activeBusiness = selected
    ? selected.id
    : status.data?.draft?.completed_at &&
        status.data.businesses.some(
          (b) => b.id === status.data?.draft?.business_id && b.complete,
        )
      ? status.data.draft.business_id
      : status.data?.businesses.find((b) => b.complete)?.id;
  useEffect(() => {
    if (session?.user.id && activeBusiness) {
      rememberBusiness(session.user.id, activeBusiness);
    }
  }, [session?.user.id, activeBusiness]);
  const titleBusiness = status.data?.businesses.find(b => b.id === activeBusiness)?.name || business?.name;
  useEffect(() => {
    const dashboardRoute = ["/overview", "/cards", "/analytics", "/platforms", "/qr-codes", "/integrations"].some(path => location.pathname === path || location.pathname.startsWith(path + "/"));
    document.title = dashboardRoute ? titleBusiness ? `Dashboard – ${titleBusiness}` : "Dashboard – Revbaze" : pageTitle(location.pathname);
  }, [location.pathname, titleBusiness]);
  useLiveWorkspace(session?.user.id, activeBusiness);
  async function switchBusiness(id: string) {
    const target = status.data?.businesses.find(
      (b) => b.id === id && b.complete,
    );
    if (!target || (id === activeBusiness && !switching)) return;
    const request = ++switchRequest.current;
    setSwitching({
      userId: session?.user.id || "",
      id,
      name: target.name,
      logo: target.logo_url || "",
      error: "",
    });
    setAccount(false);
    setMobile(false);
    try {
      const [workspace] = await Promise.all([
        client.fetchQuery({
          queryKey: ["workspace", session?.user.id || "local", id],
          queryFn: () => loadWorkspace(id),
          staleTime: 0,
        }),
        new Promise((resolve) =>
          setTimeout(
            resolve,
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 0
              : 650,
          ),
        ),
      ]);
      if (request !== switchRequest.current) return;
      if (!workspace.business || workspace.business.id !== id)
        throw new Error("This business is unavailable. Please try again.");
      useWorkspace.getState().hydrate(workspace);
      rememberBusiness(session?.user.id || "", id);
      setBusinessChoice({ userId: session?.user.id || "", id });
      navigate("/overview");
      setSwitching(null);
    } catch (error) {
      if (request === switchRequest.current)
        setSwitching({
          userId: session?.user.id || "",
          id,
          name: target.name,
          logo: target.logo_url || "",
          error:
            error instanceof Error
              ? error.message
              : "Unable to load this workspace.",
        });
    }
  }
  const needsWorkspace =
    [
      "/",
      "/overview",
      "/cards",
      "/analytics",
      "/platforms",
      "/qr-codes",
      "/integrations",
      "/profile",
      "/settings",
      "/onboarding",
    ].includes(location.pathname) || location.pathname.startsWith("/cards/");
  const query = useQuery({
    queryKey: ["workspace", session?.user.id || "local", activeBusiness],
    queryFn: () => loadWorkspace(activeBusiness),
    refetchInterval: ["/overview", "/analytics", "/cards"].includes(
      location.pathname,
    )
      ? 30_000
      : false,
    enabled:
      needsWorkspace &&
      ready &&
      Boolean(supabase && session && activeBusiness) &&
      !isAuth,
  });
  useEffect(() => {
    if (query.data) useWorkspace.getState().hydrate(query.data);
  }, [query.data]);
  useEffect(() => {
    useWorkspace.getState().hydrate(emptyWorkspace());
  }, [session?.user.id]);
  useEffect(() => {
    if (session) {
      const meta = session.user.user_metadata;
      usePreferences.getState().set({
        name:
          meta.name || session.user.email?.split("@")[0] || "Business owner",
        email: session.user.email || "",
        image: meta.avatar_url || "",
        product_notifications: meta.product_notifications ?? true,
        activity_notifications: meta.activity_notifications ?? true,
      });
    }
  }, [session]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemDark(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);
  const dark =
    preferences.theme === "dark" ||
    (preferences.theme === "system" && systemDark);
  if (switching && switching.userId === (session?.user.id || ""))
    return (
      <div className={`app ${dark ? "dark" : ""}`}>
        <BusinessSwitchScreen
          name={switching.name}
          logo={switching.logo}
          error={switching.error}
          retry={() => void switchBusiness(switching.id)}
          cancel={() => {
            switchRequest.current++;
            setSwitching(null);
          }}
        />
      </div>
    );
  if (isPublic)
    return (
      <Routes>
        <Route path="/review/:slug" element={<PublicReviewPage />} />
      </Routes>
    );
  if (!isAuth && !ready)
    return (
      <div className={`app ${dark ? "dark" : ""}`}>
        <main className="dashboard-session-loading" aria-label="Loading dashboard" aria-busy="true">
          <Skeleton />
        </main>
      </div>
    );
  if (!isAuth && !session) return <Navigate to="/login" replace />;
  if (isAuth)
    return (
      <AuthLayout>
        {!ready ? (
          <Skeleton />
        ) : !isAuth ? (
          <Navigate to="/login" replace />
        ) : (
          <Routes>
            <Route
              path="/login"
              element={<AuthPage key="login" session={session} />}
            />
            <Route
              path="/signup"
              element={<AuthPage key="signup" signup session={session} />}
            />
            <Route path="/accept-invitation" element={<AcceptInvitation session={session} />} />
            <Route path="/check-email" element={<CheckEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route
              path="/reset-password"
              element={<ResetPasswordPage session={session} />}
            />
            <Route
              path="/auth/callback"
              element={<AuthCallbackPage session={session} />}
            />
          </Routes>
        )}
      </AuthLayout>
    );
  if (isPasswordRecoverySession(session?.user.id))
    return <Navigate to="/reset-password" replace />;
  if (location.pathname === "/start-plan")
    return (
      <div className={`app settings-shell ${dark ? "dark" : ""}`}>
        <SignupCheckout />
      </div>
    );
  if (location.pathname === "/upgrade" || location.pathname === "/checkout") {
    return (
      <div className={`app settings-shell ${dark ? "dark" : ""}`}>
        {location.pathname === "/checkout" ? (
          <CheckoutReturn />
        ) : (
          <PlanChooser />
        )}
      </div>
    );
  }
  if (supabase && session) {
    if (status.isPending)
      return (
        <div className="app onboard-shell">
          <section className="onboard-container">
            <Skeleton />
          </section>
        </div>
      );
    if (status.isError)
      return (
        <div className="app onboard-shell">
          <section className="card error-state onboard-container">
            <h2>We couldn’t load your setup progress</h2>
            <p role="alert">{status.error.message}</p>
            <p>
              Apply the business schema migration and onboarding publication
              migration in Supabase, then retry.
            </p>
            <Button onClick={() => void status.refetch()}>Try again</Button>
            <Button onClick={() => void signOutFully()}>
              Sign out
            </Button>
          </section>
        </div>
      );
    const completed = status.data?.businesses.some((b) => b.complete);
    if (!completed && session.user.user_metadata.workspace_invitation)
      return <Navigate to="/accept-invitation" replace />;
    const requestedSignupPlan = session.user.user_metadata.signup_plan;
    if (
      !completed &&
      (requestedSignupPlan === "growth" || requestedSignupPlan === "pro")
    ) {
      if (!signupAccess.ready && !signupAccess.isError) return <Skeleton />;
      if (signupAccess.isError)
        return (
          <section className="card error-state">
            <p>{signupAccess.error?.message}</p>
            <Button onClick={() => void signupAccess.refetch()}>
              Try again
            </Button>
          </section>
        );
      if (signupAccess.accountPlan.id === "free")
        return <Navigate to="/start-plan" replace />;
    }
    if (!completed || location.pathname === "/onboarding") {
      if (location.pathname !== "/onboarding")
        return <Navigate to="/onboarding" replace />;
      if (completed && location.state?.businessSetup !== true)
        return <Navigate to="/overview" replace />;
      return (
        <Suspense fallback={<Skeleton />}>
          <OnboardingPage session={session} />
        </Suspense>
      );
    }
  }
  if (location.pathname === "/settings") {
    return (
      <div className={`app settings-shell ${dark ? "dark" : ""}`}>
        {!ready || query.isPending ? (
          <Skeleton />
        ) : query.isError ? (
          <section className="card error-state" role="alert">
            <h2>Settings couldn’t load</h2>
            <p>{query.error.message}</p>
            <Button onClick={() => void query.refetch()}>Try again</Button>
            <Button asChild>
              <Link to="/overview">Back to dashboard</Link>
            </Button>
          </section>
        ) : (
          <SettingsPage />
        )}
      </div>
    );
  }
  const names: Record<string, string> = {
    "/": "Overview",
    "/overview": "Overview",
    "/cards": "Review cards",
    "/analytics": "Analytics",
    "/integrations": "Integrations",
    "/platforms": "Review platforms",
    "/qr-codes": "QR codes",
    "/profile": "Business profile",
    "/settings": "Settings",
    "/onboarding": "Business setup",
    "/login": "Sign in",
    "/reset-password": "Reset password",
  };
  const page =
    names[location.pathname] ||
    (location.pathname.startsWith("/cards/")
      ? "Card editor"
      : "Page not found");
  return (
    <div
      className={`app ${dark ? "dark" : ""} ${preferences.collapsed ? "collapsed" : ""}`}
    >
      <div className={`sidebar-wrapper ${mobile ? "open" : ""}`}>
        <Sidebar
          close={() => setMobile(false)}
          businesses={status.data?.businesses.filter((b) => b.complete) || []}
          activeBusinessId={activeBusiness}
          onSelectBusiness={(id) => void switchBusiness(id)}
          businessLabel={
            status.data?.businesses.find((b) => b.id === activeBusiness)?.name
          }
        />
      </div>
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <PanelLeft size={19} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{page}</strong>
          </div>
          <div className="header-actions">
            <WorkspaceSearch key={business?.id || "no-business"} />
            <span className="header-divider" />
            <span className="mode-label">
              {supabase ? "Cloud workspace" : "Local workspace"}
            </span>
            <div className="popover-wrap">
              <button
                className="profile-button"
                aria-label="Account menu"
                aria-expanded={account}
                onClick={() => setAccount(!account)}
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
                <ChevronDown size={13} />
              </button>
              {account && (
                <div className="popover">
                  <strong>{preferences.name}</strong>
                  {status.data?.businesses
                    .filter((b) => b.complete)
                    .map((b) => (
                      <button
                        key={b.id}
                        onClick={() => void switchBusiness(b.id)}
                      >
                        {b.name}
                        {b.id === activeBusiness ? " · Current" : ""}
                      </button>
                    ))}
                  <p>{preferences.email || "Local business workspace"}</p>
                  <Link to="/settings">
                    Settings
                    <ArrowUpRight size={13} />
                  </Link>
                  <Link to="/onboarding?new=1" state={{ businessSetup: true }}>
                    Set up a new business
                    <Plus size={13} />
                  </Link>
                  <Link to="/settings?tab=business">
                    Business profile
                    <ArrowUpRight size={13} />
                  </Link>
                  {session ? (
                    <button
                      onClick={async () => {
                        await signOutFully();
                        client.clear();
                        setAccount(false);
                      }}
                    >
                      <LogOut size={13} />
                      Sign out
                    </button>
                  ) : (
                    <Link to="/login">Sign in / create account</Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <main>
          {!ready ? (
            <Skeleton />
          ) : supabase && !session && !isAuth ? (
            <Navigate to="/login" replace />
          ) : !isAuth && query.isPending ? (
            <Skeleton />
          ) : !isAuth && query.isError ? (
            <section className="card error-state" role="alert">
              <CircleHelp size={25} />
              <h2>We couldn’t load your workspace</h2>
              <p>{query.error.message}</p>
              <Button onClick={() => query.refetch()}>Try again</Button>
              <p>
                Check your Supabase configuration and apply the database
                migration before using cloud mode.
              </p>
            </section>
          ) : supabase &&
            session &&
            !business &&
            !query.data?.business &&
            query.data &&
            !isAuth &&
            needsWorkspace &&
            location.pathname !== "/onboarding" &&
            location.pathname !== "/profile" &&
            location.pathname !== "/settings" ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <Suspense fallback={<Skeleton />}>
              <Routes>
                <Route path="/" element={<Navigate to="/overview" replace />} />
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/cards" element={<CardsPage />} />
                <Route path="/cards/new" element={<CardEditor />} />
                <Route
                  path="/cards/:id/edit"
                  element={<CardEditor key={location.pathname} />}
                />
                <Route path="/platforms" element={<PlatformsPage />} />
                <Route
                  path="/analytics"
                  element={
                    <PlanGate feature="analytics">
                      <AnalyticsPage />
                    </PlanGate>
                  }
                />
                <Route
                  path="/integrations"
                  element={
                    <PlanGate feature="integrations">
                      <IntegrationsPage />
                    </PlanGate>
                  }
                />
                <Route path="/qr-codes" element={<QRCodesPage />} />
                <Route
                  path="/profile"
                  element={<Navigate to="/settings?tab=business" replace />}
                />
                <Route path="/settings" element={<SettingsPage />} />
                <Route
                  path="/onboarding"
                  element={
                    <section className="card error-state">
                      <h2>Cloud setup required</h2>
                      <p>
                        Configure Supabase to save drafts and publish a review
                        card.
                      </p>
                    </section>
                  }
                />
                <Route
                  path="*"
                  element={
                    <section className="card error-state">
                      <h2>That page has moved</h2>
                      <p>Revbaze is now your review link workspace.</p>
                      <Button asChild>
                        <Link to="/">Back to overview</Link>
                      </Button>
                    </section>
                  }
                />
              </Routes>
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}
export default function App() {
  const [bootReady, setBootReady] = useState(!authCallback.active || !supabase);
  useEffect(() => {
    void authBootstrap.finally(() => setBootReady(true)).catch(() => {});
  }, []);
  if (!bootReady)
    return (
      <div className="app">
        <section className="onboard-container">
          <Skeleton />
        </section>
      </div>
    );
  const marketingPaths = [
    "/",
    "/product",
    "/features",
    "/solutions",
    "/pricing",
    "/about",
    "/contact",
    "/resources",
    "/privacy",
    "/terms",
  ];
  const publicMarketing =
    !authCallback.active &&
    !window.location.hash.startsWith("#/") &&
    (marketingPaths.includes(window.location.pathname) ||
      window.location.pathname.startsWith("/resources/"));
  if (publicMarketing)
    return (
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="app marketing-loading" role="status">
              Loading Revbaze…
            </div>
          }
        >
          <MarketingSite />
        </Suspense>
      </BrowserRouter>
    );
  return (
    <QueryClientProvider client={client}>
      <HashRouter>
        <FeedbackProvider>
          <Workspace />
        </FeedbackProvider>
      </HashRouter>
    </QueryClientProvider>
  );
}
