import type { JoinedTable } from "./join-tables.types";

const tableId = (schema: string, table: string) => `${schema}.${table}`;

/**
 * Removes the specified join and any joins that are (transitively) anchored to it via `joinFrom`.
 *
 * Example: if C.joinFrom = B and B.joinFrom = A, removing B removes both B and C.
 *
 * Returns the filtered joins list and a count of how many were removed.
 */
export const cascadeRemoveJoins = (input: {
  joins: JoinedTable[];
  remove: { schema: string; table: string };
}): { joins: JoinedTable[]; removedCount: number } => {
  const removeSet = new Set<string>([tableId(input.remove.schema, input.remove.table)]);

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const join of input.joins) {
      if (!join.joinFrom) continue;
      const anchorId = tableId(join.joinFrom.schema, join.joinFrom.table);
      if (!removeSet.has(anchorId)) continue;

      const joinId = tableId(join.schema, join.table);
      if (!removeSet.has(joinId)) {
        removeSet.add(joinId);
        progressed = true;
      }
    }
  }

  const filtered = input.joins.filter((j) => !removeSet.has(tableId(j.schema, j.table)));
  const removedCount = input.joins.length - filtered.length;

  return { joins: filtered, removedCount };
};
