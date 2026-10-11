import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../stores/workspace";

/** Only metadata changes reload a workspace. Analytics use small, visible-tab polls. */
export function useLiveWorkspace(
  userId: string | undefined,
  businessId: string | undefined,
) {
  const client = useQueryClient();
  const loadedBusiness = useWorkspace((s) => s.business?.id);
  useEffect(() => {
    if (!supabase || !userId || !businessId || loadedBusiness !== businessId)
      return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const refresh = () => {
      if (timer || document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        timer = undefined;
        void client.invalidateQueries({
          queryKey: ["workspace", userId, businessId],
        });
        for (const key of [
          "card-performance",
          "overview-summary",
          "analytics-summary",
          "analytics-business-comparison",
        ])
          void client.invalidateQueries({ queryKey: [key, userId] });
      }, 1000);
    };
    const sync = () => {
      if (document.visibilityState !== "visible") {
        if (timer) clearTimeout(timer);
        timer = undefined;
        if (channel) void supabase!.removeChannel(channel);
        channel = undefined;
        return;
      }
      if (channel) return;
      channel = supabase!.channel(`workspace-metadata:${userId}:${businessId}`);
      for (const table of ["review_cards", "business_review_links"])
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `business_id=eq.${businessId}`,
          },
          refresh,
        );
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "businesses",
          filter: `id=eq.${businessId}`,
        },
        refresh,
      );
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", sync);
      if (channel) void supabase!.removeChannel(channel);
    };
  }, [client, userId, businessId, loadedBusiness]);
}
