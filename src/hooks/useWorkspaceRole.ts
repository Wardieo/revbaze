import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../stores/workspace";
import { useSession } from "./useSession";
import type { MemberRoster } from "../features/settings/WorkspaceMembers";
export function useWorkspaceRole() {
  const businessId = useWorkspace(s => s.business?.id);
  const { session, ready } = useSession();
  const query = useQuery({ queryKey: ["workspace-members", businessId, session?.user.id], enabled: Boolean(supabase && ready && session && businessId), queryFn: async () => {
    const { data, error } = await supabase!.rpc("workspace_members", { p_business: businessId });
    if (error) throw new Error(error.message);
    return data as MemberRoster;
  }, staleTime: 0, refetchInterval: 5000, retry: false });
  const role = query.data?.role;
  return { ...query, role, canEdit: role === "owner" || role === "admin" || role === "editor", canManageBusiness: role === "owner" || role === "admin", isOwner: role === "owner" };
}
