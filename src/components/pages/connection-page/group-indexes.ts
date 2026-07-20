import type { IndexInfo } from "#src/server/introspection/introspection.ts";

export interface GroupedIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

/**
 * Collapse per-column IndexInfo rows into one entry per index name.
 */
export const groupIndexesByName = (indexes: readonly IndexInfo[]): GroupedIndex[] => {
  const map = new Map<string, GroupedIndex>();

  for (const idx of indexes) {
    const existing = map.get(idx.index_name);
    if (existing) {
      if (!existing.columns.includes(idx.column_name)) {
        existing.columns.push(idx.column_name);
      }
      existing.isUnique = existing.isUnique || idx.is_unique;
      existing.isPrimary = existing.isPrimary || idx.is_primary;
    } else {
      map.set(idx.index_name, {
        name: idx.index_name,
        columns: [idx.column_name],
        isUnique: idx.is_unique,
        isPrimary: idx.is_primary,
      });
    }
  }

  return [...map.values()].toSorted((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.isUnique !== b.isUnique) return a.isUnique ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
};
