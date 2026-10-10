import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useSession } from "./useSession";
export type DowngradeAccess = {
  plan: string;
  businesses: { id: string; name: string; available: boolean }[];
  cards: {
    id: string;
    business_id: string;
    name: string;
    available: boolean;
    active: boolean;
  }[];
  links: {
    id: string;
    business_id: string;
    card_id: string;
    name: string;
    available: boolean;
  }[];
};
export function useDowngradeAccess() {
  const { session } = useSession();
  return useQuery({
    queryKey: ["downgrade-access", session?.user.id],
    enabled: Boolean(supabase && session),
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("downgrade_access_status");
      if (error)
        throw new Error(
          "Unable to load plan availability. Apply migration 013 and retry.",
        );
      return data as DowngradeAccess;
    },
    refetchInterval: 30000,
  });
}
