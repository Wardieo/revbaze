import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export default function PerformanceChart({
  data,
  masked = false,
}: {
  data: { date: string; views: number; clicks: number }[];
  masked?: boolean;
}) {
  const [visible, setVisible] = useState({ views: true, clicks: true });
  return (
    <>
      <div className="overview-chart-controls">
        {(["views", "clicks"] as const).map((key) => (
          <button
            key={key}
            aria-pressed={visible[key]}
            onClick={() => setVisible({ ...visible, [key]: !visible[key] })}
          >
            <i
              style={{
                background: key === "views" ? "#042751" : "#67b096",
                opacity: visible[key] ? 1 : 0.25,
              }}
            />
            {key === "views" ? "Page views" : "Outbound clicks"}
          </button>
        ))}
      </div>
      <div className="activity-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={masked ? data.map(point => ({ ...point, clicks: 0 })) : data}
            margin={{ top: 15, right: 12, left: -18, bottom: 5 }}
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="date"
              tickFormatter={(date) =>
                new Date(date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "Asia/Manila",
                })
              }
              minTickGap={36}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#64748b" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#64748b" }}
              allowDecimals={false}
            />
            <Tooltip
              formatter={masked ? (value, name) => [name === "Outbound clicks" ? "—" : value, name] : undefined}
              labelFormatter={(date) =>
                new Date(String(date)).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  timeZone: "Asia/Manila",
                })
              }
              contentStyle={{
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
              }}
            />
            {visible.views && (
              <Area
                type="monotone"
                dataKey="views"
                name="Page views"
                stroke="#042751"
                fill="#04275115"
                strokeWidth={2}
                isAnimationActive={false}
              />
            )}{" "}
            {visible.clicks && (
              <Area
                type="monotone"
                dataKey="clicks"
                name="Outbound clicks"
                stroke="#67b096"
                strokeWidth={2}
                fill="transparent"
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
