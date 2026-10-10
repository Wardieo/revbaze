import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useSession } from "../../hooks/useSession";
import { usePlan } from "../../hooks/usePlan";
import { supabase } from "../../lib/supabase";
import { openBilling } from "../../services/billing";
import { Button } from "../../components/ui/Button";
import { planCatalog } from "../../lib/plans";
import "./billing.css";
export function SignupCheckout() {
  const { session } = useSession();
  const access = usePlan(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const selection = session?.user.user_metadata.signup_plan;
  const plan = selection === "pro" ? "pro" : "growth";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const cancelled = params.get("cancelled") === "1";
  async function checkout() {
    setBusy(true);
    setError("");
    try {
      await openBilling("checkout", plan, "/start-plan?cancelled=1");
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Unable to open checkout.");
    }
  }
  useEffect(() => {
    if (!access.ready || !session) return;
    if (access.accountPlan.id !== "free" || selection === "free") {
      navigate("/onboarding", { replace: true });
      return;
    }
    if (!cancelled && !started.current) {
      started.current = true;
      void checkout();
    }
    // A single automatic request; retries are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.ready, access.accountPlan.id, session, selection, cancelled]);
  async function free() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      data: { signup_plan: "free" },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    navigate("/onboarding", { replace: true });
  }
  return (
    <div className="checkout-return">
      <section className="checkout-return-card signup-checkout-card">
        <span className="signup-checkout-label">{planCatalog[plan].name} · monthly subscription</span>
        <h1>Choose {planCatalog[plan].name}</h1>
        <p>Finish checkout, then make your business yours.</p>
        <div className="signup-checkout-price"><strong>${planCatalog[plan].monthly}</strong><span>per month</span><small>USD · Billed monthly</small></div>
        <p className="signup-checkout-details">Your first payment is collected at checkout. Once payment is confirmed, you’ll continue to business setup with {planCatalog[plan].name} access.</p>
        {cancelled && (
          <p role="status">
            Checkout was cancelled. You haven’t started a subscription.
          </p>
        )}
        {(error || access.isError) && (
          <p role="alert" className="billing-error">
            {error || access.error?.message}
          </p>
        )}
        <Button
          variant="primary"
          disabled={busy || !access.ready}
          onClick={() => void checkout()}
        >
          {busy ? (
            <>
              <LoaderCircle size={16} className="billing-spinner" />
              Opening checkout…
            </>
          ) : (
            "Continue to checkout"
          )}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void free()}>
          Continue with Free instead
        </Button>
      </section>
    </div>
  );
}
