import { lazy, Suspense } from "react";
const ComparisonLineChart = lazy(() => import("./ComparisonLineChart"));
export type ComparisonRow = {
  id: string;
  name: string;
  views: number;
  clicks: number;
  ctr: number;
  visitors?: number;
};

/** Shared scale lets readers compare absolute views and clicks across rows. */
export function ComparisonVisual({
  rows,
  vertical = false,
}: {
  rows: ComparisonRow[];
  vertical?: boolean;
}) {
  const leading = rows.reduce<ComparisonRow | null>(
    (best, row) => (row.views > (best?.views || 0) ? row : best),
    null,
  );
  return (
    <div
      className={`analytics-comparison-visual${vertical ? " vertical" : ""}`}
    >
      <div className="comparison-legend">
        <span>
          <i />
          Page views
        </span>
        <span>
          <i />
          Outbound clicks
        </span>
        <small>Views and clicks · same scale</small>
      </div>
      {!rows.length ? (
        <p className="analytics-section-message">
          No results for this selection.
        </p>
      ) : (
        <>
          <Suspense
            fallback={
              <div
                className="comparison-line-chart loading-skeleton"
                role="status"
                aria-label="Loading chart"
              />
            }
          >
            <ComparisonLineChart rows={rows} />
          </Suspense>
          <div className="comparison-rows">
            {rows.map((row, index) => (
              <article
                key={row.id}
                className={`comparison-item${row.id === leading?.id ? " leading" : ""}`}
              >
                <div className="comparison-item-heading">
                  <strong title={row.name}>
                    {!vertical && (
                      <span className="comparison-rank">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    )}
                    {row.name}
                  </strong>
                  <span className="comparison-ctr">
                    {row.ctr.toFixed(1)}% CTR
                  </span>
                </div>
                <div className="comparison-values">
                  <span>
                    <b>{row.views.toLocaleString()}</b> views
                  </span>
                  <span>
                    <b>{row.clicks.toLocaleString()}</b> clicks
                  </span>
                  {row.visitors !== undefined && (
                    <span>
                      <b>{row.visitors.toLocaleString()}</b> unique browsers
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
