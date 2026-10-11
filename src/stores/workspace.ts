import { queryClient } from "../lib/queryClient";
import { create } from "zustand";
import { emptyWorkspace } from "../types/workspace";
import type {
  Business,
  ReviewCard,
  ReviewLink,
  WorkspaceData,
} from "../types/workspace";
import * as repository from "../services/workspace";
export const useWorkspace = create<
  WorkspaceData & {
    busy: boolean;
    error: string;
    hydrate: (data: WorkspaceData) => void;
    mutate: (operation: () => Promise<void>) => Promise<void>;
    saveBusiness: (business: Business) => Promise<void>;
    saveLink: (link: ReviewLink) => Promise<void>;
    deleteLink: (id: string) => Promise<void>;
    saveCard: (card: ReviewCard) => Promise<void>;
    deleteCard: (id: string) => Promise<void>;
  }
>((set, get) => ({
  ...emptyWorkspace(),
  busy: false,
  error: "",
  hydrate: (data) => set({ ...data, error: "" }),
  mutate: async (operation) => {
    if (get().busy)
      throw new Error("Please wait for your current change to finish.");
    const businessId = get().business?.id;
    set({ busy: true, error: "" });
    try {
      await operation();
      const data = await repository.loadWorkspace(businessId);
      if (get().business?.id === businessId) {
        set(data);
        queryClient.setQueriesData(
          {
            queryKey: ["workspace"],
            predicate: (query) => query.queryKey[2] === businessId,
          },
          data,
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["account-plan"] });
      for (const key of [
        "card-performance",
        "overview-summary",
        "analytics-summary",
        "analytics-business-comparison",
      ])
        void queryClient.invalidateQueries({ queryKey: [key] });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save your changes.";
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ busy: false });
    }
  },
  saveBusiness: (business) =>
    get().mutate(() => repository.saveBusiness(business)),
  saveLink: (link) => get().mutate(() => repository.saveLink(link)),
  deleteLink: (id) => get().mutate(() => repository.deleteLink(id)),
  saveCard: (card) => get().mutate(() => repository.saveCard(card)),
  deleteCard: (id) => get().mutate(() => repository.deleteCard(id)),
}));
