import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 120_000, gcTime: 15 * 60_000, refetchOnReconnect: true },
  },
});
