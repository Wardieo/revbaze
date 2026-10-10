import { lazy, Suspense } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { EmptyState } from "../../components/shared/Feedback";
import type { CardEvent } from "../../types/workspace";
const TrendChart = lazy(() => import("./TrendChart"));
export function ActivityChart({
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
  if (!events.length)
    return (
      <EmptyState
        icon={<ChartNoAxesCombined size={25} />}
        title="Your story is just getting started"
        description="Views and clicks will appear here when customers visit your published cards."
      />
    );
  return (
    <Suspense
      fallback={
        <div
          className="activity-chart loading-skeleton"
          aria-label="Loading chart"
          role="status"
        />
      }
    >
      <TrendChart
        events={events}
        timeZone={timeZone}
        from={from}
        to={to}
        grouping={grouping}
        showViews={showViews}
        showClicks={showClicks}
      />
    </Suspense>
  );
}
