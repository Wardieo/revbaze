import type { CardEvent } from "../../types/workspace";
import { useState } from "react";
import {
  Globe2,
  Link2,
  QrCode,
  Megaphone,
  ArrowDown,
  ArrowUp,
  Compass,
} from "lucide-react";
import "./traffic-sources.css";
export function TrafficSources({
  sources,
  events = [],
  uniqueCounts,
}: {
  sources: Map<string, number>;
  events?: CardEvent[];
  uniqueCounts?: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = [...sources].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  return (
    <section className="card analytics-traffic">
      <div className="card-heading">
        <div>
          <h2>Traffic sources</h2>
          <p>How customers find your review pages.</p>
        </div>
        <span className="traffic-heading-icon">
          <Compass size={19} />
        </span>
      </div>
      {total ? (
        <>
          <div className="traffic-summary">
            <div>
              <strong>{total.toLocaleString()}</strong>
              <span>page views</span>
            </div>
            <span>
              {rows.length} {rows.length === 1 ? "source" : "sources"}
            </span>
          </div>
          <div className="traffic-column-labels">
            <span>Source</span>
            <span>Views · Share</span>
          </div>
          <ul className="traffic-source-rows">
            {(expanded ? rows : rows.slice(0, 6)).map(([source, count]) => {
              const matching = events.filter(
                (e) =>
                  (e.traffic_source || e.referrer || "Direct / unknown") ===
                  source,
              );
              const visitors =
                uniqueCounts?.[source] ??
                new Set(
                  matching
                    .filter(
                      (e) => e.event_type === "page_view" && e.visitor_key,
                    )
                    .map((e) => e.visitor_key),
                ).size;
              const clicks = matching
                .filter((e) => e.event_type === "outbound_click")
                .reduce((sum, e) => sum + (e.count ?? 1), 0);
              const direct = source === "Direct / unknown";
              const qr = source.toLowerCase() === "qr";
              const domain = !direct && source.includes(".");
              const Icon = direct
                ? Link2
                : qr
                  ? QrCode
                  : domain
                    ? Globe2
                    : Megaphone;
              const label = qr ? "QR code" : source;
              const description = direct
                ? "No campaign or referrer available"
                : qr
                  ? "Scans of tagged review QR codes"
                  : domain
                    ? "Referring website"
                    : "Tagged campaign";
              const percent = (count / total) * 100;
              return (
                <li key={source}>
                  <span
                    className={`traffic-source-icon ${direct ? "neutral" : ""}`}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="traffic-source-content">
                    <div className="traffic-source-top">
                      <strong title={label}>{label}</strong>
                      <span>
                        <b>{count.toLocaleString()}</b>
                        <small>{percent.toFixed(1)}%</small>
                      </span>
                    </div>
                    <p>{description}</p>
                    <div className="traffic-metrics">
                      <span>{visitors} unique browsers</span>
                      <span>{clicks} clicks</span>
                      <span>{((clicks / count) * 100).toFixed(1)}% CTR</span>
                    </div>
                    <div className="traffic-source-bar" aria-hidden="true">
                      <i style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length > 6 && (
            <button
              className="traffic-expand"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              {expanded
                ? "Show fewer sources"
                : `Show all ${rows.length} sources`}
              {expanded ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          )}
          <p className="traffic-footnote">
            Share of page views in your selected date range.
          </p>
        </>
      ) : (
        <div className="traffic-empty">
          <span className="traffic-source-icon">
            <Compass size={23} />
          </span>
          <h3>No traffic in this range</h3>
          <p>
            Share your review link or QR code. Sources appear as customers visit
            your pages.
          </p>
        </div>
      )}
    </section>
  );
}
