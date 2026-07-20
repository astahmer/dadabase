import type { QueryClient } from "@tanstack/react-query";

/** Mark mutations that invalidate rows themselves and should skip the global wipe. */
export const rowMutationMeta = { noInvalidate: true } as const;

/**
 * Invalidate table-row queries in the background.
 * Does not await refetches — callers can close UI immediately.
 */
export function invalidateRowsQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    queryKey: ["remote", "rows"],
    refetchType: "active",
  });
}
