import { DowngradeSelection } from "./DowngradeSelection";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  CreditCard,
  Sparkles,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { useSession } from "../../hooks/useSession";
import { usePlan } from "../../hooks/usePlan";
import { planCatalog, planFeatures } from "../../lib/plans";
import { billingAction, openBilling } from "../../services/billing";
import "./billing.css";
export function BillingSettings() {
  const access = usePlan(null);
  const { session } = useSession();
  const current = access.accountPlan;
  const [params] = useSearchParams();
  const success = params.get("checkout") === "success";
  const requestedPlan = params.get("plan");
  const paymentConfirmed =
    access.ready &&
    current.id !== "free" &&
    (!requestedPlan || current.id === requestedPlan);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const billing = useQuery({
    queryKey: ["billing-status", session?.user.id, access.status?.plan],
    queryFn: () => billingAction("status"),
    enabled: access.ready && !!session,
    retry: false,
  });
  useEffect(() => {
    if (!success) return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > 12) {
        clearInterval(timer);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["account-plan"] });
      void queryClient.invalidateQueries({ queryKey: ["billing-status"] });
    }, 2500);
    return () => clearInterval(timer);
  }, [success, queryClient]);
  async function manage(action: "cancel" | "payment-method") {
    setBusy(true);
    setError("");
    try {
      if (action === "cancel") {
        await billingAction("cancel");
        await queryClient.invalidateQueries({ queryKey: ["billing-status"] });
        await queryClient.invalidateQueries({ queryKey: ["account-plan"] });
        setBusy(false);
      } else await openBilling("payment-method");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open billing.");
      setBusy(false);
    }
  }
  return (
    <div className="billing-settings">
      <div className="billing-section-heading">
        <div>
          <span className="billing-eyebrow">YOUR WORKSPACE, YOUR PACE</span>
          <h2>Plans & billing</h2>
          <p>A clear view of your plan and the room you have to grow.</p>
        </div>
        <span className="billing-secure">
          <ShieldCheck size={14} />
          Secure billing
        </span>
      </div>
      {success && (
        <p className="billing-notice" role="status">
          {!paymentConfirmed
            ? "Checkout returned successfully. We’re waiting for PayMongo to confirm your subscription. Your access changes only after verification."
            : `Your ${current.name} access is active. Thanks for growing with Revbaze.`}
        </p>
      )}
      {params.get("checkout") === "cancelled" && (
        <p className="billing-notice">
          Checkout was cancelled. Your plan remains unchanged.
        </p>
      )}
      {(error || access.isError) && (
        <p className="billing-error" role="alert">
          {error || access.error?.message}
        </p>
      )}
      <section className="billing-current">
        <div className="billing-current-top">
          <span className="billing-plan-icon">
            <Sparkles size={22} />
          </span>
          <div>
            <span className="billing-eyebrow">CURRENT PLAN</span>
            <h3>
              {access.ready ? current.name : "Loading…"}
              <span className="billing-active">Active</span>
            </h3>
          </div>
          <div className="billing-current-price">
            ${current.monthly}
            <span>/ month</span>
          </div>
        </div>
        <div className="billing-usage">
          {[
            {
              label: "Businesses",
              used: access.status?.businesses ?? 0,
              limit: current.businesses,
            },
            {
              label: "Review cards",
              used: access.status?.cards ?? 0,
              limit: current.cards,
            },
          ].map((item) => (
            <div key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <span>
                  {item.used} / {item.limit ?? "Unlimited"}
                </span>
              </div>
              <div className="billing-meter">
                <i
                  style={{
                    width: item.limit
                      ? `${Math.min(100, (item.used / item.limit) * 100)}%`
                      : "10%",
                  }}
                />
              </div>
              {item.limit !== null && item.used >= item.limit && (
                <small>
                  {item.used > item.limit
                    ? "Above your current limit. Existing items are kept."
                    : "You’ve reached your limit."}{" "}
                  Upgrade for more room.
                </small>
              )}
            </div>
          ))}
        </div>
        <div className="billing-current-bottom">
          <p>Limits apply across all businesses you own.</p>
          <Link className="button primary" to="/upgrade">
            {current.id === "pro" ? "Compare plans" : "Explore upgrades"}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>
      {params.get("scheduled") === "1" && (
        <p role="status" className="billing-notice">
          Your plan change applies at the next billing cycle.
        </p>
      )}
      <DowngradeSelection />
      <div className="billing-options">
        {Object.values(planCatalog)
          .filter((p) => p.id !== current.id)
          .map((p) => (
            <section className="billing-option" key={p.id}>
              <div>
                <h3>
                  {p.name}
                  {p.id === "growth" && <span>Popular</span>}
                </h3>
                <p>
                  ${p.monthly}
                  <span> / month</span>
                </p>
              </div>
              <ul>
                {planFeatures(p.id)
                  .slice(0, 4)
                  .map((f) => (
                    <li key={f}>
                      <Check size={14} />
                      {f}
                    </li>
                  ))}
              </ul>
              <Link className="button button-outline" to="/upgrade">
                Compare {p.name}
                <ArrowUpRight size={14} />
              </Link>
            </section>
          ))}
      </div>
      <section className="billing-payment">
        <span>
          <CreditCard size={23} />
        </span>
        <div>
          <h3>Subscription & payment method</h3>
          <p>
            Update your payment method or cancel future renewals here. Paid
            access remains available until the end of your verified paid period.
          </p>
          {billing.data?.cancelAtPeriodEnd && (
            <small>
              Your subscription ends{" "}
              {billing.data.periodEnd
                ? new Date(billing.data.periodEnd).toLocaleDateString()
                : "at the end of the billing period"}
              .
            </small>
          )}
          {billing.isError && (
            <small>
              Billing setup is unavailable. Your existing plan access is
              preserved.
            </small>
          )}
        </div>
        <button
          className="button button-outline"
          disabled={
            busy ||
            !billing.data?.hasCustomer ||
            billing.data?.status !== "active"
          }
          onClick={() => void manage("payment-method")}
        >
          {busy && <LoaderCircle size={15} className="billing-spinner" />}Update
          payment method
          <ArrowUpRight size={14} />
        </button>
        <button
          className="button button-outline"
          disabled={
            busy ||
            !billing.data?.hasCustomer ||
            billing.data?.cancelAtPeriodEnd
          }
          onClick={() => void manage("cancel")}
        >
          Cancel future renewals
        </button>
      </section>
    </div>
  );
}
