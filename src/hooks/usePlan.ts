import { useSession } from "./useSession";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../stores/workspace";
import { planCatalog } from "../lib/plans";
import type { PlanStatus } from "../lib/plans";
export function usePlan(businessId?: string | null) {
  const { session, ready: sessionReady } = useSession();
  const cardCount = useWorkspace((s) => s.cards.length);
  const currentBusiness = useWorkspace((s) => s.business?.id);
  const id = businessId === undefined ? currentBusiness : businessId;
  const query = useQuery({
    queryKey: [
      "account-plan",
      session?.user.id,
      id || "account",
      currentBusiness,
      cardCount,
    ],
    enabled: Boolean(supabase && sessionReady && session),
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("account_plan_status", {
        p_business_id: id || null,
      });
      if (error)
        throw new Error(
          "Unable to load plan access. Apply the plan-access migration and retry.",
        );
      if (
        !data ||
        !Object.hasOwn(planCatalog, data.plan) ||
        !Object.hasOwn(planCatalog, data.workspace_plan)
      )
        throw new Error("Invalid plan access response.");
      return data as PlanStatus;
    },
    retry: false,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const status = query.data;
  return {
    ...query,
    accountPlan: planCatalog[status?.plan || "free"],
    plan: planCatalog[status?.workspace_plan || "free"],
    status,
    // A background refresh must not unmount onboarding or disable its controls.
    // Server-side quotas remain authoritative while cached access is displayed.
    ready: !supabase || (sessionReady && Boolean(session) && query.isSuccess),
  };
}
