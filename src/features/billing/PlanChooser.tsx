import { BrandLogo } from "../../components/shared/BrandLogo";
import { useState } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import {
  Check,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";
import { usePlan } from "../../hooks/usePlan";
import { planCatalog, planFeatures } from "../../lib/plans";
import { openBilling } from "../../services/billing";
import "./billing.css";
export function PlanChooser() {
  const access = usePlan(null);
  const location = useLocation();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function choose(plan: "growth" | "pro") {
    setBusy(plan);
    setError("");
    try {
      await openBilling("checkout", plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open checkout.");
      setBusy(null);
    }
  }
  return (
    <div className="upgrade-page">
      <header className="upgrade-header">
        <Link to="/overview" className="settings-brand">
          <BrandLogo />
        </Link>
        <Link className="button button-outline" to="/overview">
          <ArrowLeft size={15} />
          {access.accountPlan.id === "free"
            ? "Continue for free"
            : "Back to dashboard"}
        </Link>
      </header>
      <main className="upgrade-content">
        <div className="upgrade-heading">
          <span className="billing-eyebrow">A LITTLE MORE ROOM TO GROW</span>
          <h1>Choose your next chapter.</h1>
          <p>
            {params.get("feature")
              ? "Unlock more possibilities for your review workspace."
              : "A simple plan for every stage of your business."}{" "}
            All prices are monthly, in USD.
          </p>
        </div>
        {(params.get("checkout") === "cancelled" ||
          location.state?.checkoutCancelled) && (
          <p className="billing-notice" role="status">
            Checkout was cancelled. You can choose a plan whenever you’re ready.
          </p>
        )}
        {(error || access.isError) && (
          <p className="billing-error" role="alert">
            {error || access.error?.message}
          </p>
        )}
        <div className="upgrade-grid">
          {Object.values(planCatalog).map((plan) => (
            <section
              key={plan.id}
              className={`upgrade-plan ${plan.id === "growth" ? "popular" : ""}`}
            >
              <div className="upgrade-plan-intro">
                <div className="upgrade-plan-name">
                  <h2>{plan.name}</h2>
                  {plan.id === "growth" && <span>Most popular</span>}
                </div>
                <p>
                  {plan.id === "free"
                    ? "Start with one beautiful invitation."
                    : plan.id === "growth"
                      ? "Build momentum across your business."
                      : "Make room for every location and idea."}
                </p>
                <div className="upgrade-price">
                  ${plan.monthly}
                  <span>/ month</span>
                </div>
                <small>
                  {plan.id === "free"
                    ? "No payment required"
                    : "Billed monthly · First payment at checkout"}
                </small>
                {access.ready && access.accountPlan.id === plan.id ? (
                  <button
                    type="button"
                    className="button button-outline"
                    disabled
                  >
                    Current plan
                  </button>
                ) : plan.id === "free" ? (
                  <Link
                    className="button button-outline"
                    to={
                      access.accountPlan.id === "free"
                        ? "/overview"
                        : "/settings?tab=billing"
                    }
                  >
                    {access.accountPlan.id === "free"
                      ? "Continue for free"
                      : "Manage subscription"}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={`button ${plan.id === "growth" ? "primary" : "button-outline"}`}
                    disabled={
                      !access.ready ||
                      Boolean(busy) ||
                      access.accountPlan.id === plan.id
                    }
                    onClick={() => void choose(plan.id)}
                  >
                    {busy === plan.id ? (
                      <LoaderCircle className="billing-spinner" size={16} />
                    ) : null}
                    {`Choose ${plan.name}`}
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
              <div className="upgrade-plan-features">
                <strong>
                  {plan.id === "free"
                    ? "The essentials"
                    : plan.id === "growth"
                      ? "More flexibility, more insight"
                      : "Your biggest ideas, supported"}
                </strong>
                <ul>
                  {planFeatures(plan.id).map((feature) => (
                    <li key={feature}>
                      <Check size={16} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
        <div className="upgrade-assurance">
          <span>
            <LockKeyhole size={15} />
            Secure checkout with Stripe
          </span>
          <span>
            <ShieldCheck size={15} />
            Monthly subscriptions · no annual commitment
          </span>
        </div>
        <p className="billing-footnote">
          Unlimited usage is subject to fair use. Analytics and integrations
          currently show sample activity. CSV import, live webhooks, and
          priority-support delivery are planned capabilities.
        </p>
        <Link className="billing-back" to="/settings?tab=billing">
          View your current plan and usage
          <ArrowRight size={14} />
        </Link>
      </main>
    </div>
  );
}
