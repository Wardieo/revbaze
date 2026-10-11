import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../hooks/useSession";
import type { PaymentSetup } from "../../services/billing";
import "./billing.css";
export function PayMongoPayment() {
  const { session } = useSession();
  const [year] = useState(() => new Date().getFullYear());
  const [method, setMethod] = useState("card"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  let payment: PaymentSetup | undefined;
  try {
    payment =
      JSON.parse(
        sessionStorage.getItem(`revbaze-payment:${session?.user.id}`) || "null",
      ) || undefined;
  } catch {
    /* expired setup */
  }
  const selectedMethod = payment?.methods.includes(method)
    ? method
    : payment?.methods[0] || "card";
  const updating = payment?.purpose === "payment-method";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payment) return;
    setBusy(true);
    setError("");
    const form = event.currentTarget,
      fields = new FormData(form);
    try {
      const call = async (
        path: string,
        attributes: Record<string, unknown>,
      ) => {
        const res = await fetch(`https://api.paymongo.com/v1/${path}`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(payment!.publicKey + ":")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: { attributes } }),
        });
        const json = await res.json();
        if (!res.ok)
          throw new Error(
            "Payment could not be completed. Check your details and try again.",
          );
        return json.data;
      };
      const pm = await call("payment_methods", {
        type: selectedMethod,
        billing: {
          name: fields.get("name"),
          email: session?.user.email,
          phone: fields.get("phone"),
        },
        ...(selectedMethod === "card"
          ? {
              details: {
                card_number: String(fields.get("card")).replace(/\s/g, ""),
                exp_month: Number(fields.get("month")),
                exp_year: Number(fields.get("year")),
                cvc: fields.get("cvc"),
              },
            }
          : {}),
      });
      // Clear sensitive fields immediately after tokenization. Card details never go to Revbaze servers or storage.
      form.reset();
      const intent = await call(
        `payment_intents/${encodeURIComponent(payment.intentId)}/attach`,
        {
          payment_method: pm.id,
          client_key: payment.clientKey,
          return_url: payment.returnUrl,
        },
      );
      if (intent.attributes.status === "awaiting_next_action") {
        const u = new URL(intent.attributes.next_action.redirect.url);
        if (u.protocol !== "https:" || u.username || u.password)
          throw new Error("Invalid payment authentication URL");
        window.location.assign(u.href);
      } else if (
        intent.attributes.status === "succeeded" ||
        intent.attributes.status === "processing"
      )
        window.location.assign(payment.returnUrl);
      else throw new Error("Payment was not completed. Please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment unavailable");
      setBusy(false);
    }
  }
  if (!payment || payment.userId !== session?.user.id)
    return (
      <div className="signup-checkout">
        <section className="signup-checkout-card">
          <h1>Start checkout again</h1>
          <p>Your payment setup is unavailable.</p>
          <Link to="/upgrade">Choose a plan</Link>
        </section>
      </div>
    );
  return (
    <div className="signup-checkout">
      <section className="signup-checkout-card">
        <h1>
          {updating
            ? "Update your payment method"
            : "Complete your subscription"}
        </h1>
        <p>PayMongo processes your payment securely.</p>
        <h2>
          {new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: payment.currency,
          }).format(payment.amount / 100)}{" "}
          {updating ? "temporary authorization" : "/ month"}
        </h2>
        <p>
          {updating
            ? "PayMongo temporarily authorizes your new payment method and cancels that authorization."
            : "The base price is in USD. Your PHP renewal amount follows the daily USD/PHP conversion rate and may change each month."}
        </p>
        <form onSubmit={(e) => void submit(e)}>
          <label>
            Payment method
            <select
              value={selectedMethod}
              onChange={(e) => setMethod(e.target.value)}
            >
              {payment.methods.includes("card") && (
                <option value="card">Visa / Mastercard</option>
              )}
              {payment.methods.includes("paymaya") && (
                <option value="paymaya">Maya</option>
              )}
            </select>
          </label>
          <label>
            Full name
            <input name="name" required autoComplete="cc-name" />
          </label>
          <label>
            Mobile number
            <input name="phone" required type="tel" autoComplete="tel" />
          </label>
          {selectedMethod === "card" && (
            <>
              <label>
                Card number
                <input
                  name="card"
                  required
                  inputMode="numeric"
                  autoComplete="cc-number"
                  maxLength={23}
                />
              </label>
              <div className="payment-card-fields">
                <label>
                  Expiry month
                  <input
                    name="month"
                    type="number"
                    required
                    min={1}
                    max={12}
                    autoComplete="cc-exp-month"
                  />
                </label>
                <label>
                  Expiry year
                  <input
                    name="year"
                    type="number"
                    required
                    min={year}
                    max={2099}
                    autoComplete="cc-exp-year"
                  />
                </label>
                <label>
                  CVC
                  <input
                    name="cvc"
                    type="password"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{3,4}"
                    autoComplete="cc-csc"
                    maxLength={4}
                  />
                </label>
              </div>
            </>
          )}
          <label className="payment-consent">
            <input type="checkbox" required />I authorize monthly recurring
            payments at the PHP equivalent of my USD plan price until I cancel.
          </label>
          {error && (
            <p role="alert" className="billing-error">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Processing…" : "Authorize subscription"}
          </button>
        </form>
        <small>
          <a
            href="https://www.exchangerate-api.com"
            target="_blank"
            rel="noreferrer"
          >
            Rates by ExchangeRate-API
          </a>
        </small>
        <Link to="/settings?tab=billing">Back to billing</Link>
      </section>
    </div>
  );
}
