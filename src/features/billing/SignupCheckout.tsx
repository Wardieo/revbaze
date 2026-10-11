import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../../hooks/useSession";
import { usePlan } from "../../hooks/usePlan";
import { supabase } from "../../lib/supabase";
import { openBilling } from "../../services/billing";
import { Button } from "../../components/ui/Button";
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
  if (busy || (!error && !access.isError && !cancelled)) {
    return (
      <div className="checkout-return">
        <div
          className="signup-checkout-loading"
          role="status"
          aria-live="polite"
        >
          <div className="signup-checkout-loading-line" aria-hidden="true" />
          <p>Opening Stripe checkout…</p>
        </div>
      </div>
    );
  }
  return (
    <div className="checkout-return">
      <section className="checkout-return-card signup-checkout-card">
        <h1>{cancelled ? "Checkout cancelled" : "Unable to open checkout"}</h1>
        {cancelled && <p role="status">Try again or continue with Free.</p>}
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
          Try checkout again
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void free()}>
          Continue with Free instead
        </Button>
      </section>
    </div>
  );
}
