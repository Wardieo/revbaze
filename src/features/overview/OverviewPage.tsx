import { useWorkspaceRole } from "../../hooks/useWorkspaceRole";
import { useDowngradeAccess } from "../../hooks/useDowngradeAccess";
import { useCopyFeedback } from "../../hooks/useCopyFeedback";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LockKeyhole,
  Check,
  Eye,
  MousePointerClick,
  ArrowUpRight,
  ArrowDownRight,
  PanelsTopLeft,
  Copy,
  Link2,
  ArrowRight,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/shared/Feedback";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
import { useFeedback } from "../../hooks/useFeedback";
import { workspaceOverview } from "./activity";
import { useWorkspace } from "../../stores/workspace";
import { usePlan } from "../../hooks/usePlan";
import { cardUrl } from "../../lib/validation";
import "./overview.css";
const PerformanceChart = lazy(() => import("./PerformanceChart"));
const number = (n: number) => n.toLocaleString("en-US");
export function OverviewPage() {
  const availability = useDowngradeAccess();
  const [days, setDays] = useState(30);
  const notify = useFeedback();
  const { copiedValue, markCopied } = useCopyFeedback();
  const workspace = useWorkspace();
  const access = usePlan();
  const accountAccess = usePlan();
  const workspaceRole = useWorkspaceRole();
  const available = access.ready;
  const platformAccess = access.ready && access.plan.analyticsMonths > 0;
  const data = useMemo(
    () => workspaceOverview(workspace, days),
    [workspace, days],
  );
  const shareCards = workspace.cards.filter(
    (c) =>
      c.is_active &&
      availability.data?.cards.find((item) => item.id === c.id)?.available !==
        false,
  );
  const [selectedCard, setSelectedCard] = useState("");
  const shareCard =
    shareCards.find((c) => c.id === selectedCard) || shareCards[0];
  const reviewLink = shareCard ? cardUrl(shareCard.slug) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reviewLink);
      markCopied(reviewLink);
      notify("Review link copied.");
    } catch {
      notify("Could not copy. Select the link and copy it manually.", true);
    }
  };
  const statistics = [
    {
      name: "Total Page Views",
      value: available ? number(data.stats.views) : "—",
      icon: Eye,
      current: data.stats.views,
      previous: data.previous.views,
      detail: "Visits to your review pages",
    },
    {
      name: "Review Link Clicks",
      value: available ? number(data.stats.clicks) : "—",
      icon: MousePointerClick,
      current: data.stats.clicks,
      previous: data.previous.clicks,
      detail: "Outbound clicks to review platforms",
    },
    {
      name: "Click-Through Rate",
      value: available ? data.stats.ctr.toFixed(1) + "%" : "—",
      icon: ArrowUpRight,
      current: data.stats.ctr,
      previous: data.previous.ctr,
      detail: "Link clicks divided by page views",
    },
    {
      name: "Active Review Cards",
      value: number(data.active),
      icon: PanelsTopLeft,
      current: 0,
      previous: 0,
      detail: `${data.cards.length} cards · ${data.cards.length - data.active} inactive`,
    },
  ];
  return (
    <div className="overview-demo">
      {availability.data &&
        (availability.data.businesses.some((b) => !b.available) ||
          availability.data.cards.some((c) => !c.available)) && (
          <section className="card overview-paused-notice">
            <div>
              <h2>Some saved items are paused</h2>
              <p>
                Your plan limits public access. Choose what stays available or
                upgrade to restore your saved work.
              </p>
            </div>
            <Link className="button primary" to="/settings?tab=billing">
              Manage plan access
            </Link>
          </section>
        )}
      <div className="dashboard-filter">
        <div>
          <span className="period-label">Performance overview</span>
          <div className="overview-periods" aria-label="Overview date range">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                aria-pressed={days === n}
                onClick={() => setDays(n)}
              >
                Last {n} days
              </button>
            ))}
          </div>
        </div>
        <span className="overview-demo-label">
          <span className="tiny-dot" />
          Workspace activity
        </span>
      </div>
      <div className="stats-grid">
        {statistics.map(
          ({ name, value, icon: Icon, current, previous, detail }) => {
            const change = previous
              ? ((current - previous) / previous) * 100
              : 0;
            const Trend = change >= 0 ? ArrowUpRight : ArrowDownRight;
            return (
              <section className="stat-card" key={name}>
                <div className="stat-label">
                  <span>{name}</span>
                  <Icon size={17} />
                </div>
                <div className="stat-value">{value}</div>
                <div className="overview-stat-detail">
                  {available && previous > 0 && (
                    <span
                      className={`overview-change ${change < 0 ? "down" : ""}`}
                    >
                      <Trend size={12} />
                      {Math.abs(change).toFixed(1)}%
                    </span>
                  )}
                  <span>
                    {!available && name !== "Active Review Cards"
                      ? "Analytics requires Growth or Pro"
                      : previous > 0
                        ? `vs previous ${days} days`
                        : detail}
                  </span>
                </div>
              </section>
            );
          },
        )}
      </div>
      <div className="dashboard-grid">
        <section className="card activity-card">
          <div className="card-heading">
            <div>
              <h2>Review link performance</h2>
              <p>See how visits turn into opportunities for feedback.</p>
            </div>
            <span className="count-badge">{days} days</span>
          </div>
          <Suspense fallback={<Skeleton />}>
            {available ? (
              <PerformanceChart data={data.chart} />
            ) : (
              <div className="overview-empty">
                <Eye size={28} />
                <h3>See how your links perform</h3>
                <p>Analytics is available with Growth and Pro.</p>
                <Link className="text-link" to="/upgrade">
                  Explore plans <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </Suspense>
        </section>
        <section className="card distribution-card">
          <div className="card-heading">
            <div>
              <h2>Top Review Platforms</h2>
              <p>Where your customers go next.</p>
            </div>
            <MousePointerClick size={17} className="muted" />
          </div>
          {!platformAccess && (
            <div className="overview-platform-lock">
              <div className="locked-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div className="overview-platform-lock-content">
                <LockKeyhole size={28} />
                <h3>Unlock platform insights</h3>
                <p>
                  See which review platforms get the most clicks with Growth or
                  Pro.
                </p>
                <Button asChild>
                  <Link to="/upgrade">
                    Upgrade plan <ArrowRight size={14} />
                  </Link>
                </Button>
              </div>
            </div>
          )}
          {platformAccess && (
            <>
              <div className="overview-platform-total">
                <strong>
                  {platformAccess ? number(data.stats.clicks) : "—"}
                </strong>
                <span>total outbound clicks</span>
              </div>
              {platformAccess &&
                data.platforms.map((p) => (
                  <div className="distribution-row" key={p.id}>
                    <PlatformIcon id={p.id} />
                    <div>
                      <strong>{p.name}</strong>
                      <div className="platform-track">
                        <i
                          style={{
                            width: `${p.percent}%`,
                            background: p.color,
                          }}
                        />
                      </div>
                      <small>
                        {number(p.clicks)} clicks
                        <span>{p.percent.toFixed(1)}%</span>
                      </small>
                    </div>
                  </div>
                ))}
              {(!platformAccess || !data.platforms.length) && (
                <p className="overview-empty-note">
                  {platformAccess
                    ? "No platform clicks in this date range yet."
                    : "Upgrade to see your platform click distribution."}
                </p>
              )}
            </>
          )}
        </section>
      </div>
      <div
        className={`overview-share-grid ${accountAccess.ready && workspaceRole.isOwner && accountAccess.plan.id !== "pro" ? "with-upgrade" : ""}`}
      >
        <section className="card overview-share">
          <span className="overview-link-icon">
            <Link2 size={23} />
          </span>
          <div className="overview-share-copy">
            <div className="overview-share-title">
              <h2>Your Review Link</h2>
              {shareCards.length > 1 && (
                <select
                  aria-label="Review card to share"
                  value={shareCard?.id}
                  onChange={(e) => setSelectedCard(e.target.value)}
                >
                  {shareCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p>One simple invitation to share with your customers.</p>
            <input
              aria-label="Your review link"
              readOnly
              value={reviewLink || "No active review card yet"}
              onFocus={(e) => e.target.select()}
            />
            <small>
              {shareCard
                ? "Share this card with your customers."
                : "Activate a review card to get your shareable link."}
            </small>
          </div>
          <div className="overview-share-buttons">
            <Button disabled={!reviewLink} onClick={copy} variant="primary">
              {copiedValue === reviewLink ? (
                <Check size={14} />
              ) : (
                <Copy size={14} />
              )}
              <span aria-live="polite">
                {copiedValue === reviewLink ? "Copied" : "Copy Link"}
              </span>
            </Button>
          </div>
        </section>
        {accountAccess.ready && workspaceRole.isOwner && accountAccess.plan.id !== "pro" && (
          <aside className="card overview-upgrade">
            <span className="count-badge">
              {accountAccess.plan.name} plan
            </span>
            <h2>
              {accountAccess.plan.id === "free"
                ? "Give your business room to grow"
                : "More possibilities with Pro"}
            </h2>
            <p>
              {accountAccess.plan.id === "free"
                ? "Add more cards, customize QR codes, and discover what drives clicks."
                : "Unlimited businesses and review cards, with 24 months of analytics."}
            </p>
            <Link to="/upgrade" className="button primary">
              {accountAccess.plan.id === "free"
                ? "Explore Growth · $10/month"
                : "Explore Pro · $29/month"}
              <ArrowRight size={15} />
            </Link>
          </aside>
        )}
      </div>
      <section className="card overview-recent">
        <div className="card-heading">
          <div>
            <h2>
              Recent Review Cards{" "}
              <span className="count-badge">{data.cards.length}</span>
            </h2>
            <p>
              Your invitations and their performance over the last {days} days.
            </p>
          </div>
          <Link to="/cards" className="text-link">
            View all cards
            <ArrowRight size={13} />
          </Link>
        </div>
        <div className="overview-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Review card</th>
                <th>Views</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.cards.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="overview-card-name">
                      <span className="mini-card-icon">
                        <PanelsTopLeft size={17} />
                      </span>
                      <div>
                        <strong>{c.name}</strong>
                        <small>{c.channel}</small>
                      </div>
                    </div>
                  </td>
                  <td>{available ? number(c.views) : "—"}</td>
                  <td>{available ? number(c.clicks) : "—"}</td>
                  <td>{available ? c.ctr.toFixed(1) + "%" : "—"}</td>
                  <td>
                    <span
                      className={`status-badge ${c.active ? "active" : "inactive"}`}
                    >
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {!data.cards.length && (
                <tr>
                  <td colSpan={5}>
                    No review cards yet. Your cards will appear here once
                    created.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <footer>
        <span>Made for honest customer conversations.</span>
        <span>Outbound clicks aren’t completed reviews</span>
      </footer>
    </div>
  );
}
