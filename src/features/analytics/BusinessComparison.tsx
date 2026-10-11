import { ComparisonVisual } from "./ComparisonVisual";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../../hooks/useSession";
import { usePlan } from "../../hooks/usePlan";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";

export function BusinessComparison({
  from,
  to,
  timeZone,
}: {
  from: string;
  to: string;
  timeZone: string;
}) {
  const access = usePlan();
  const { session } = useSession();
  const query = useQuery({
    queryKey: [
      "analytics-business-comparison",
      session?.user.id,
      access.plan.id,
      timeZone,
      from,
      to,
    ],
    enabled: Boolean(
      from &&
      to &&
      from <= to &&
      supabase &&
      session &&
      access.ready &&
      access.plan.analyticsMonths > 0,
    ),
    queryFn: async () => {
      const { data, error } = await supabase!.rpc(
        "business_comparison_summary",
        { p_from: from, p_to: to, p_timezone: timeZone },
      );
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        views: number;
        clicks: number;
        visitors: number;
        ctr: number;
      }[];
    },
    refetchInterval: 60000,
  });
  if (!access.ready || !access.plan.analyticsMonths || !supabase) return null;
  return (
    <section className="card performance-table">
      <div className="card-heading">
        <div>
          <h2>Across your businesses</h2>
          <p>
            Compare all businesses you own for this date range. Card, platform,
            and source filters apply to the workspace reports above.
          </p>
        </div>
      </div>
      {query.isPending ? (
        <p className="analytics-section-message" role="status">
          Loading business performance…
        </p>
      ) : query.isError ? (
        <div className="analytics-section-message" role="alert">
          <p>Unable to load business performance.</p>
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </div>
      ) : (
        <ComparisonVisual
          rows={[...(query.data || [])].sort((a, b) => b.views - a.views)}
        />
      )}
    </section>
  );
}
