import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparisonRow } from "./ComparisonVisual";
export default function ComparisonLineChart({
  rows,
}: {
  rows: ComparisonRow[];
}) {
  const id = useId().replaceAll(":", "");
  return (
    <div
      className="comparison-line-chart"
      role="img"
      aria-label="Comparison of page views and outbound clicks. Exact values are listed below the chart."
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows}
          margin={{ top: 20, right: 24, left: 0, bottom: 12 }}
        >
          <defs>
            <linearGradient id={`${id}-views`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#042751" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#042751" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={`${id}-clicks`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#55b69e" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#55b69e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            minTickGap={24}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickFormatter={(name: string) =>
              name.length > 18 ? name.slice(0, 17) + "…" : name
            }
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            width={42}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="comparison-chart-tooltip">
                  <strong>{payload[0].payload.name}</strong>
                  <span>
                    Page views{" "}
                    <b>{payload[0].payload.views.toLocaleString()}</b>
                  </span>
                  <span>
                    Outbound clicks{" "}
                    <b>{payload[0].payload.clicks.toLocaleString()}</b>
                  </span>
                  <span>
                    Click-through rate{" "}
                    <b>{payload[0].payload.ctr.toFixed(1)}%</b>
                  </span>
                  {payload[0].payload.visitors !== undefined && (
                    <span>
                      Unique browsers{" "}
                      <b>{payload[0].payload.visitors.toLocaleString()}</b>
                    </span>
                  )}
                </div>
              ) : null
            }
          />
          <Area
            type="linear"
            dataKey="views"
            name="Page views"
            stroke="#042751"
            strokeWidth={2.5}
            fill={`url(#${id}-views)`}
            dot={{
              r: 4,
              fill: "#042751",
              stroke: "var(--surface)",
              strokeWidth: 2,
            }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
          <Area
            type="linear"
            dataKey="clicks"
            name="Outbound clicks"
            stroke="#55b69e"
            strokeWidth={2.5}
            fill={`url(#${id}-clicks)`}
            dot={{
              r: 4,
              fill: "#55b69e",
              stroke: "var(--surface)",
              strokeWidth: 2,
            }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
