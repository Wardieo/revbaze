import { BrandLogo } from "../../components/shared/BrandLogo";
import "./analytics-upgrades.css";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../../hooks/useSession";
import { loadTimezoneEvents } from "../../services/workspace";
import { ComparisonVisual } from "./ComparisonVisual";
import { BusinessComparison } from "./BusinessComparison";
import { TrafficSources } from "./TrafficSources";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Download,
  Printer,
  Eye,
  MousePointerClick,
  ArrowUpRight,
  Users,
} from "lucide-react";
import { EmptyState } from "../../components/shared/Feedback";
import { Button } from "../../components/ui/Button";
import { useWorkspace } from "../../stores/workspace";
import {
  filterEvents,
  metrics,
  previousAnalyticsRange,
  uniqueBrowsers,
} from "../../lib/analytics";
import { platforms } from "../../lib/platforms";
import { ActivityChart } from "./ActivityChart";
import { analyticsDay } from "../../lib/analytics";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
const platformChartColors: Record<string, string> = {
  google: "#4285f4",
  facebook: "#6366f1",
  trustpilot: "#10b981",
  yelp: "#ef4444",
  g2: "#f97316",
  capterra: "#eab308",
  tripadvisor: "#14b8a6",
  "product-hunt": "#ec4899",
  "app-store": "#a855f7",
  "google-play": "#84cc16",
  custom: "#64748b",
  other: "#a8a29e",
};
export function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const { cards, links, events: workspaceEvents, business } = useWorkspace();
  const { session } = useSession();
  const [timeZone, setTimeZone] = useState(() => {
    try {
      const stored = localStorage.getItem("revbaze-analytics-timezone");
      if (stored) {
        new Intl.DateTimeFormat("en", { timeZone: stored });
        return stored;
      }
    } catch {
      /* Use browser timezone. */
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  });
  const timeZones = [
    ...new Set([
      timeZone,
      "UTC",
      "Asia/Manila",
      ...((
        Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
      ).supportedValuesOf?.("timeZone") || [
        "America/New_York",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Paris",
        "Asia/Tokyo",
        "Australia/Sydney",
      ]),
    ]),
  ].sort();
  const timezoneQuery = useQuery({
    queryKey: ["analytics-timezone", session?.user.id, business?.id, timeZone],
    enabled: Boolean(business && timeZone !== "Asia/Manila"),
    queryFn: () => loadTimezoneEvents(business!.id, timeZone),
    refetchInterval: 30000,
  });
  const events =
    timeZone === "Asia/Manila" ? workspaceEvents : timezoneQuery.data || [];
  const card = params.get("card") || "";
  const setCard = (id: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (id) next.set("card", id);
      else next.delete("card");
      return next;
    });
  const [reportNow] = useState(() => new Date());
  const today = analyticsDay(reportNow, timeZone);
  const [source, setSource] = useState("");
  const sourceName = (event: (typeof events)[number]) =>
    event.traffic_source || event.referrer || "Direct / unknown";
  const sourceMatches = (items: typeof events) =>
    source ? items.filter((e) => sourceName(e) === source) : items;
  const [platform, setPlatform] = useState("");
  const [days, setDays] = useState("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const selectedCard = cards.some((c) => c.id === card) ? card : "";
  const selectedPlatform =
    links.some((l) => l.platform_id === platform) ||
    events.some((e) => e.platform_id === platform)
      ? platform
      : "";
  const dateError =
    days === "custom" && (!from || !to || from > to || to > today)
      ? "Choose a start and end date, with the end date on or after the start date."
      : "";
  const rangeStart = new Date(`${today}T12:00:00Z`);
  rangeStart.setUTCDate(
    rangeStart.getUTCDate() - Number(days === "custom" ? "30" : days) + 1,
  );
  const chartFrom =
    days === "custom" ? from : rangeStart.toISOString().slice(0, 10);
  const chartTo = days === "custom" ? to : today;
  const filtered = sourceMatches(
    dateError
      ? []
      : filterEvents(events, {
          days: days === "custom" ? "30" : days,
          from: days === "custom" ? from : "",
          to: days === "custom" ? to : "",
          card: selectedCard,
          platform: selectedPlatform,
          links,
          timeZone,
        }),
  );
  const stats = metrics(filtered);
  const uniqueVisitors = uniqueBrowsers;
  const previousRange = previousAnalyticsRange(chartFrom, chartTo);
  const previousEvents = sourceMatches(
    dateError || !previousRange
      ? []
      : filterEvents(events, {
          from: previousRange.from,
          to: previousRange.to,
          card: selectedCard,
          platform: selectedPlatform,
          links,
          timeZone,
        }),
  );
  const previousStats = metrics(previousEvents);
  const change = (current: number, previous: number, points = false) =>
    previous === 0
      ? current === 0
        ? "No change"
        : "No previous activity"
      : `${current >= previous ? "+" : ""}${(points ? current - previous : ((current - previous) / previous) * 100).toFixed(1)}${points ? " pp" : "%"} vs previous period`;
  const [grouping, setGrouping] = useState<"daily" | "weekly">("daily");
  const [showViews, setShowViews] = useState(true);
  const [showClicks, setShowClicks] = useState(true);
  const clickCounts = new Map<string, number>();
  filtered
    .filter((event) => event.event_type === "outbound_click")
    .forEach((event) => {
      const id =
        event.platform_id ||
        links.find((link) => link.id === event.business_review_link_id)
          ?.platform_id ||
        "other";
      clickCounts.set(id, (clickCounts.get(id) || 0) + (event.count ?? 1));
    });
  const counts = [...clickCounts]
    .map(([id, count]) => ({
      id,
      count,
      name: platforms.find((p) => p.id === id)?.name || "Other destinations",
      color: platformChartColors[id] || platformChartColors.other,
      previous: previousEvents
        .filter(
          (e) =>
            e.event_type === "outbound_click" &&
            (e.platform_id ||
              links.find((l) => l.id === e.business_review_link_id)
                ?.platform_id ||
              "other") === id,
        )
        .reduce((sum, e) => sum + (e.count ?? 1), 0),
    }))
    .sort((a, b) => b.count - a.count);
  const referrers = new Map<string, number>();
  filtered
    .filter((e) => e.event_type === "page_view")
    .forEach((e) => {
      const source = e.traffic_source || e.referrer || "Direct / unknown";
      referrers.set(source, (referrers.get(source) || 0) + (e.count ?? 1));
    });
  function exportCsv() {
    if (dateError) return;
    let content =
      `Reporting timezone,${timeZone}\nFrom,To,Card,Unique browsers,Page views,Outbound clicks,Outbound CTR\n` +
      cards
        .filter((c) => !selectedCard || c.id === selectedCard)
        .map((c) => {
          const m = metrics(filtered.filter((e) => e.review_card_id === c.id));
          const name = /^[=+@\-\t\r]/.test(c.name) ? "'" + c.name : c.name;
          return `"${chartFrom}","${chartTo}","${name.replaceAll('"', '""')}",${uniqueVisitors(filtered.filter((e) => e.review_card_id === c.id))},${m.views},${m.clicks},${m.ctr.toFixed(2)}%`;
        })
        .join("\n");
    const cell = (value: string) =>
      `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    content +=
      "\n\nPlatform,Outbound clicks,Share,Previous clicks\n" +
      counts
        .map(
          (p) =>
            `${cell(p.name)},${p.count},${((p.count / stats.clicks) * 100).toFixed(1)}%,${p.previous}`,
        )
        .join("\n");
    content +=
      "\n\nTraffic source,Unique browsers,Page views,Outbound clicks,CTR\n" +
      [...referrers]
        .map(([name, views]) => {
          const items = filtered.filter((e) => sourceName(e) === name);
          const clicks = metrics(items).clicks;
          return `${cell(name)},${uniqueBrowsers(items)},${views},${clicks},${((clicks / views) * 100).toFixed(1)}%`;
        })
        .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "revbaze-card-analytics.csv";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="analytics-page">
      <header className="analytics-print-brand">
        <BrandLogo />
        <h1>Analytics report</h1>
        <p>
          {chartFrom} – {chartTo}
        </p>
      </header>
      <div className="analytics-filters">
        <select
          aria-label="Reporting timezone"
          value={timeZone}
          onChange={(e) => {
            setTimeZone(e.target.value);
            try {
              localStorage.setItem(
                "revbaze-analytics-timezone",
                e.target.value,
              );
            } catch {
              /* Session-only preference. */
            }
          }}
        >
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by traffic source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">All traffic sources</option>
          {[...new Set(events.map(sourceName))].sort().map((name) => (
            <option key={name} value={name}>
              {name === "qr" ? "QR code" : name}
            </option>
          ))}
        </select>
        <select
          aria-label="Analytics date range"
          value={days}
          onChange={(e) => {
            setDays(e.target.value);
            if (e.target.value === "custom" && !from && !to) {
              const end = new Date();
              const start = new Date(end);
              start.setDate(start.getDate() - 29);
              setFrom(analyticsDay(start, timeZone));
              setTo(analyticsDay(end, timeZone));
            }
          }}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="custom">Custom range</option>
        </select>
        {days === "custom" && (
          <>
            <input
              aria-label="Analytics start date"
              type="date"
              value={from}
              max={to || today}
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? "analytics-date-error" : undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              aria-label="Analytics end date"
              type="date"
              value={to}
              min={from || undefined}
              max={today}
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? "analytics-date-error" : undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        )}
        <select
          aria-label="Filter analytics by card"
          value={selectedCard}
          onChange={(e) => setCard(e.target.value)}
        >
          <option value="">All review cards</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter analytics by platform"
          value={selectedPlatform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value="">All platforms</option>
          {platforms
            .filter(
              (p) =>
                links.some((l) => l.platform_id === p.id) ||
                events.some((e) => e.platform_id === p.id),
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <Button
          className="analytics-export"
          onClick={exportCsv}
          disabled={
            Boolean(dateError) ||
            !cards.length ||
            (timeZone !== "Asia/Manila" && !timezoneQuery.isSuccess)
          }
        >
          <Download size={16} />
          Export analytics
        </Button>
        <Button
          className="analytics-print"
          onClick={() => window.print()}
          disabled={
            Boolean(dateError) ||
            (timeZone !== "Asia/Manila" && !timezoneQuery.isSuccess)
          }
        >
          <Printer size={16} />
          Print report
        </Button>
      </div>
      {timeZone !== "Asia/Manila" && timezoneQuery.isPending && (
        <p role="status">Loading activity for {timeZone}…</p>
      )}
      {timeZone !== "Asia/Manila" && timezoneQuery.isError && (
        <div role="alert" className="form-error">
          <p>{timezoneQuery.error.message}</p>
          <Button onClick={() => void timezoneQuery.refetch()}>Retry</Button>
          <Button onClick={() => setTimeZone("Asia/Manila")}>
            Use Manila timezone
          </Button>
        </div>
      )}
      {dateError && (
        <p id="analytics-date-error" role="alert" className="form-error">
          {dateError}
        </p>
      )}
      {(timeZone === "Asia/Manila" || timezoneQuery.isSuccess) && (
        <>
          <div className="stats-grid">
            {[
              {
                label: "Page views",
                value: stats.views.toLocaleString(),
                icon: Eye,
                detail: "Visits to your card pages",
                comparison: change(stats.views, previousStats.views),
              },
              {
                label: "Unique visitors",
                value: uniqueVisitors(filtered).toLocaleString(),
                icon: Users,
                detail: "Distinct browsers in the selected range",
                comparison: change(
                  uniqueVisitors(filtered),
                  uniqueVisitors(previousEvents),
                ),
              },
              {
                label: "Outbound link clicks",
                value: stats.clicks.toLocaleString(),
                icon: MousePointerClick,
                detail: "Clicks to external destinations",
                comparison: change(stats.clicks, previousStats.clicks),
              },
              {
                label: "Outbound CTR",
                value: `${stats.ctr.toFixed(1)}%`,
                icon: ArrowUpRight,
                detail: "Outbound clicks ÷ page views",
                comparison: change(stats.ctr, previousStats.ctr, true),
              },
            ].map(({ label, value, icon: Icon, detail, comparison }) => (
              <div className="stat-card" key={label}>
                <div className="stat-label">
                  <span>{label}</span>
                  <Icon size={17} />
                </div>
                <div className="stat-value">{value}</div>
                <p className="stat-description">{detail}</p>
                <span className="analytics-comparison">
                  {dateError ? "Select a valid range" : comparison}
                </span>
              </div>
            ))}
          </div>
          {!dateError && (
            <p className="analytics-period">
              {chartFrom} – {chartTo} · Compared with {previousRange?.from} –{" "}
              {previousRange?.to}. Comparisons include only history retained by
              your plan.
            </p>
          )}
          {stats.views >= 10 && counts.length > 0 && (
            <aside className="analytics-insight">
              <strong>Your leading destination</strong>
              <p>
                {counts[0].name} received {counts[0].count} outbound clicks (
                {((counts[0].count / stats.clicks) * 100).toFixed(1)}% of
                clicks) in this range. These are clicks, not confirmed reviews.
              </p>
            </aside>
          )}
          <section className="card activity-card">
            <div className="card-heading">
              <div>
                <h2>Views & outbound clicks</h2>
                <p>
                  {platform
                    ? "Platform filter applies to outbound clicks; page views remain the denominator."
                    : "One clear view of your card’s activity."}
                </p>
              </div>
            </div>
            <div className="analytics-chart-controls">
              <button
                aria-pressed={showViews}
                onClick={() => setShowViews(!showViews)}
              >
                Page views
              </button>
              <button
                aria-pressed={showClicks}
                onClick={() => setShowClicks(!showClicks)}
              >
                Outbound clicks
              </button>
              <select
                aria-label="Chart grouping"
                value={grouping}
                onChange={(e) =>
                  setGrouping(e.target.value as "daily" | "weekly")
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <ActivityChart
              timeZone={timeZone}
              grouping={grouping}
              showViews={showViews}
              showClicks={showClicks}
              events={filtered}
              from={dateError ? undefined : chartFrom}
              to={dateError ? undefined : chartTo}
            />
          </section>
          <div className="dashboard-grid bottom">
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>Platform click distribution</h2>
                  <p>Where your customers choose to go.</p>
                </div>
              </div>
              {counts.length ? (
                <div className="distribution-list">
                  {counts.map((p) => (
                    <div className="distribution-row" key={p.id}>
                      <PlatformIcon id={p.id} />
                      <div>
                        <strong>{p.name}</strong>
                        <div className="platform-track">
                          <i
                            style={{
                              width: `${(p.count / stats.clicks) * 100}%`,
                              background: p.color,
                            }}
                          />
                        </div>
                        <small>
                          {p.count} clicks
                          <span>
                            {((p.count / stats.clicks) * 100).toFixed(1)}%
                          </span>
                        </small>
                        <p className="analytics-platform-change">
                          {change(p.count, p.previous)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<MousePointerClick size={24} />}
                  title="No outbound clicks yet"
                  description="Clicks will appear when customers use your published review links."
                />
              )}
            </section>
            <TrafficSources sources={referrers} events={filtered} />
          </div>
          <div className="analytics-comparison-grid">
            <section className="card performance-table">
              <div className="card-heading">
                <div>
                  <h2>Performance by review card</h2>
                  <p>Comparable counts from the selected date range.</p>
                </div>
              </div>
              {cards.length ? (
                <ComparisonVisual
                  rows={cards
                    .filter((c) => !selectedCard || c.id === selectedCard)
                    .map((c) => ({
                      id: c.id,
                      name: c.name,
                      ...metrics(
                        filtered.filter((e) => e.review_card_id === c.id),
                      ),
                    }))
                    .sort((a, b) => b.views - a.views)}
                />
              ) : (
                <EmptyState
                  title="Create a card to start"
                  description="Card performance will be organized here once your first invitation is created."
                />
              )}
            </section>
            {!dateError && (
              <BusinessComparison
                from={chartFrom}
                to={chartTo}
                timeZone={timeZone}
              />
            )}
          </div>
          {!dateError && (
            <section className="card analytics-weekdays">
              <div className="card-heading">
                <div>
                  <h2>Activity by weekday</h2>
                  <p>Totals for the selected range, reported in {timeZone}.</p>
                </div>
              </div>
              <ComparisonVisual
                vertical
                rows={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (name, index) => ({
                    id: name,
                    name,
                    ...metrics(
                      filtered.filter(
                        (e) =>
                          (new Date(
                            `${analyticsDay(e.created_at, timeZone)}T12:00:00Z`,
                          ).getUTCDay() +
                            6) %
                            7 ===
                          index,
                      ),
                    ),
                  }),
                )}
              />
            </section>
          )}
          <p className="phase-caption">
            An outbound click is not a completed review. Review submissions on
            external platforms cannot be verified by this dashboard. Unique
            visitors count anonymous browsers, not identified people. Older
            visits without identifiers cannot be deduplicated.
          </p>
        </>
      )}
    </div>
  );
}
