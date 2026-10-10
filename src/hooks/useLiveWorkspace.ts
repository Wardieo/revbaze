import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../stores/workspace";

export function useLiveWorkspace(
  userId: string | undefined,
  businessId: string | undefined,
) {
  const client = useQueryClient();
  const cardIds = useWorkspace((s) =>
    s.cards
      .map((c) => c.id)
      .sort()
      .join(","),
  );
  const loadedBusiness = useWorkspace((s) => s.business?.id);
  useEffect(() => {
    if (
      !supabase ||
      !userId ||
      !businessId ||
      loadedBusiness !== businessId
    )
      return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        void client.invalidateQueries({
          queryKey: ["workspace", userId, businessId],
        });
      }, 250);
    };
    const channel = supabase.channel(
      `workspace-events:${userId}:${businessId}`,
    );
    for (const table of ["review_cards", "business_review_links"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `business_id=eq.${businessId}` }, refresh);
    }
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "businesses", filter: `id=eq.${businessId}` }, refresh);
    const ids = cardIds ? cardIds.split(",") : [];
    // Realtime IN filters accept at most 100 values per binding.
    for (let offset = 0; offset < ids.length; offset += 100) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "review_card_events",
          filter: `review_card_id=in.(${ids.slice(offset, offset + 100).join(",")})`,
        },
        refresh,
      );
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") refresh();
    });
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onFocus);
      void supabase!.removeChannel(channel);
    };
  }, [client, userId, businessId, loadedBusiness, cardIds]);
}
