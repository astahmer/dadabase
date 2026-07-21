import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidate schema/table/column metadata after DDL.
 * Fire-and-forget — UI can close immediately.
 */
export function invalidateSchemaMetadataQueries(
  queryClient: QueryClient,
  input: { url: string; schema: string },
) {
  void queryClient.invalidateQueries({
    queryKey: ["remote", "tableList"],
    refetchType: "active",
  });
  void queryClient.invalidateQueries({
    queryKey: ["remote", "allTableColumns"],
    refetchType: "active",
  });
  void queryClient.invalidateQueries({
    queryKey: ["remote", "tableColumns"],
    refetchType: "active",
  });
  void queryClient.invalidateQueries({
    queryKey: ["remote", "tablesStructures"],
    refetchType: "active",
  });
  void queryClient.invalidateQueries({
    queryKey: ["remote", "tableIndexes"],
    refetchType: "active",
  });
  // Broad remote metadata refresh for any other introspection keys
  void queryClient.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      q.queryKey[0] === "remote" &&
      typeof q.queryKey[1] === "string" &&
      (q.queryKey[1].includes("table") ||
        q.queryKey[1].includes("Table") ||
        q.queryKey[1].includes("Column") ||
        q.queryKey[1].includes("structure")),
    refetchType: "active",
  });
  void input;
}
