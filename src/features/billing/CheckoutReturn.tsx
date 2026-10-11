import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, LoaderCircle, ArrowRight } from "lucide-react";
import { billingAction } from "../../services/billing";
import { usePlan } from "../../hooks/usePlan";
import { checkoutReturnPath } from "../../../supabase/functions/_shared/billing-core";
import "./billing.css";
export function CheckoutReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const access = usePlan(null);
  const { refetch } = access;
  const cancelled = params.get("result") === "cancelled";
  const selected = params.get("plan");
  const validPlan = selected === "growth" || selected === "pro";
  const confirmed =
    validPlan && access.ready && access.accountPlan.id === selected;
  const returnTo = checkoutReturnPath(params.get("returnTo"));
  const destination = returnTo.startsWith("/start-plan")
    ? "/onboarding"
    : "/overview";
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (cancelled)
      navigate(returnTo, { replace: true, state: { checkoutCancelled: true } });
  }, [cancelled, navigate, returnTo]);
  useEffect(() => {
    if (cancelled || !validPlan || confirmed) return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > 30) {
        clearInterval(timer);
        setExpired(true);
        return;
      }
      void billingAction("status")
        .then(() => refetch())
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [cancelled, validPlan, confirmed, refetch]);
  useEffect(() => {
    if (!confirmed) return;
    const timer = setTimeout(
      () => navigate(destination, { replace: true }),
      4000,
    );
    return () => clearTimeout(timer);
  }, [confirmed, navigate, destination]);
  return (
    <div className="checkout-return checkout-status-page">
      <section
        className={`checkout-return-card checkout-status-card ${confirmed ? "is-confirmed" : ""}`}
        aria-live="polite"
      >
        <div className="checkout-status-label">
          {confirmed ? (
            <Check size={15} />
          ) : validPlan && !expired && !cancelled ? (
            <LoaderCircle size={15} className="billing-spinner" />
          ) : null}
          {confirmed
            ? "Subscription confirmed"
            : cancelled
              ? "Checkout cancelled"
              : expired
                ? "Confirmation pending"
                : "Secure checkout"}
        </div>
        <h1>
          {cancelled
            ? "Heading back…"
            : confirmed
              ? `Welcome to ${access.accountPlan.name}.`
              : !validPlan
                ? "Choose your next plan."
                : expired
                  ? "We’re still waiting for confirmation."
                  : "Getting everything ready."}
        </h1>
        <p>
          {confirmed
            ? destination === "/onboarding"
              ? "Your plan is active. Let’s create a review experience that feels like your business."
              : "Your new plan is active. Your workspace now has access to its included features."
            : cancelled
              ? "Your plan hasn’t changed. Returning to your previous screen."
              : !validPlan
                ? "Choose Growth or Pro to start a secure checkout."
                : "We’re waiting for verified subscription access from PayMongo. This can take a moment."}
        </p>
        {confirmed && (
          <>
            <div className="checkout-status-summary">
              <div>
                <span>Your plan</span>
                <strong>{access.accountPlan.name}</strong>
              </div>
              <div>
                <span>Monthly rate</span>
                <strong>
                  ${access.accountPlan.monthly}
                  <small> USD / month</small>
                </strong>
              </div>
              <p>
                Your subscription renews monthly. Manage your subscription in
                Settings.
              </p>
            </div>
            <div className="checkout-status-steps">
              <div>
                <span className="done">
                  <Check size={14} />
                </span>
                <div>
                  <strong>Checkout confirmed</strong>
                  <small>Your plan access is ready</small>
                </div>
              </div>
              <div>
                <span>2</span>
                <div>
                  <strong>
                    {destination === "/onboarding"
                      ? "Set up your business"
                      : "Return to your workspace"}
                  </strong>
                  <small>
                    {destination === "/onboarding"
                      ? "Add your details and create your first card"
                      : "Explore your new plan’s features"}
                  </small>
                </div>
              </div>
            </div>
          </>
        )}
        {access.isError && (
          <p role="alert" className="billing-error">
            {access.error?.message}
          </p>
        )}
        {expired && (
          <button
            type="button"
            className="button primary"
            onClick={() => void access.refetch()}
          >
            Check again
          </button>
        )}
        <Link
          className={`button ${confirmed ? "primary" : "button-outline"}`}
          to={confirmed ? destination : returnTo}
        >
          {confirmed
            ? destination === "/onboarding"
              ? "Continue to business setup"
              : "Open dashboard"
            : "Back to previous page"}
          <ArrowRight size={15} />
        </Link>
        {confirmed ? (
          <div className="checkout-redirect-note">
            <span />
            Continuing automatically in a moment…
          </div>
        ) : (
          <small className="checkout-verification-note">
            Access is granted only after server verification.
          </small>
        )}
      </section>
    </div>
  );
}
