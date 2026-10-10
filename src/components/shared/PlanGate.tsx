import { Check, LockKeyhole, ArrowRight, BarChart3, Plug } from "lucide-react";
import { PlatformIcon } from "./PlatformIcon";
import "../../features/billing/billing.css";
import { Link } from "react-router-dom";
import { usePlan } from "../../hooks/usePlan";
import type { ReactNode } from "react";
export function PlanGate({
  feature,
  children,
}: {
  feature: "analytics" | "integrations";
  children: ReactNode;
}) {
  const access = usePlan();
  if (!access.ready)
    return (
      <section className="card padded" role="status">
        <h2>
          {access.isError ? "Plan access unavailable" : "Checking your plan…"}
        </h2>
        {access.isError && (
          <>
            <p>{access.error?.message}</p>
            <button onClick={() => void access.refetch()}>Try again</button>
          </>
        )}
      </section>
    );
  const allowed =
    feature === "analytics"
      ? access.plan.analyticsMonths > 0
      : access.plan.integrations;
  if (!allowed)
    return (
      <section className="upgrade-gate">
        <div>
          <span className="billing-eyebrow">A LITTLE MORE POSSIBILITY</span>
          <h2>
            {feature === "analytics" ? "Analytics" : "Integrations"} is included
            with Growth and Pro
          </h2>
          <p>
            {feature === "analytics"
              ? "See which invitations resonate. Explore page views, platform clicks, and the paths your customers take."
              : "Bring your review workflow closer to the tools your team already loves."}
          </p>
          <ul>
            <li>
              <Check size={14} />
              {feature === "analytics"
                ? "12–24 months of history"
                : "Your everyday tools"}
            </li>
            <li>
              <Check size={14} />
              {feature === "analytics"
                ? "Platform click insights"
                : "One connected workspace"}
            </li>
          </ul>
          <div className="upgrade-gate-actions">
            <Link className="button primary" to={`/upgrade?feature=${feature}`}>
              Explore plans
              <ArrowRight size={15} />
            </Link>
            <span>Growth from $10/month</span>
          </div>
        </div>
        <div className="upgrade-gate-visual">
          <div>
            <span>
              {feature === "analytics"
                ? "A clearer view of your activity"
                : "Your tools, working together"}
            </span>
            <LockKeyhole size={15} />
          </div>
          {feature === "analytics" ? (
            <div className="upgrade-gate-bars" aria-hidden="true">
              {[35, 55, 43, 70, 62, 85, 74, 98].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          ) : (
            <div className="upgrade-gate-logos">
              {["zapier", "slack", "make", "n8n", "google", "mailchimp"].map(
                (id) => (
                  <PlatformIcon key={id} id={id} />
                ),
              )}
            </div>
          )}
          <small>
            {feature === "analytics" ? (
              <BarChart3 size={16} />
            ) : (
              <Plug size={16} />
            )}{" "}
            Product preview · paid access required
          </small>
        </div>
      </section>
    );
  return children;
}
