import { analyticsDay } from "../../lib/analytics";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CardEvent } from "../../types/workspace";
export default function TrendChart({
  events,
  timeZone = "Asia/Manila",
  from,
  to,
  grouping = "daily",
  showViews = true,
  showClicks = true,
}: {
  events: CardEvent[];
  timeZone?: string;
  from?: string;
  to?: string;
  grouping?: "daily" | "weekly";
  showViews?: boolean;
  showClicks?: boolean;
}) {
  const days = new Map<
    string,
    { date: string; views: number; clicks: number }
  >();
  if (from && to) {
    const date = new Date(`${from}T12:00:00Z`);
    const end = new Date(`${to}T12:00:00Z`);
    for (; date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
      const key = date.toISOString().slice(0, 10);
      days.set(key, { date: key, views: 0, clicks: 0 });
    }
  }
  events.forEach((e) => {
    const date = analyticsDay(e.created_at, timeZone);
    const row = days.get(date) || { date, views: 0, clicks: 0 };
    if (e.event_type === "page_view") row.views += e.count ?? 1;
    else row.clicks += e.count ?? 1;
    days.set(date, row);
  });
  const buckets = new Map<
    string,
    { date: string; views: number; clicks: number }
  >();
  for (const row of [...days.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    const date = new Date(`${row.date}T12:00:00Z`);
    if (grouping === "weekly")
      date.setUTCDate(
        date.getUTCDate() -
          ((new Date(`${row.date}T12:00:00Z`).getUTCDay() + 6) % 7),
      );
    const key = date.toISOString().slice(0, 10);
    const bucket = buckets.get(key) || { date: key, views: 0, clicks: 0 };
    bucket.views += row.views;
    bucket.clicks += row.clicks;
    buckets.set(key, bucket);
  }
  return (
    <div className="activity-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={[...buckets.values()]}
          margin={{ top: 20, right: 20, left: -15, bottom: 5 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 4"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            minTickGap={32}
            tickFormatter={(value) =>
              new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })
            }
            tick={{ fontSize: 13, fill: "#969dab" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 13, fill: "#969dab" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
          {showViews && (
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="views"
              name="Page views"
              stroke="#042751"
              fill="#04275115"
              strokeWidth={2}
            />
          )}
          {showClicks && (
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="clicks"
              name="Outbound clicks"
              stroke="#67b096"
              fill="transparent"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
