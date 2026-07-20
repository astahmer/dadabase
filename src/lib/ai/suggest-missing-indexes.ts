import type { AiColumnMeta, AiIndexMeta } from "./ai-types.ts";

export type IndexSuggestionReason = "foreign_key" | "filter_usage" | "order_usage";

export interface IndexSuggestion {
  columns: string[];
  reason: IndexSuggestionReason;
  /** Human-readable explanation */
  message: string;
  /** Suggested CREATE INDEX statement (postgres-style identifiers) */
  createSql: string;
}

export interface SuggestMissingIndexesInput {
  schema: string;
  table: string;
  columns: readonly AiColumnMeta[];
  /** Flat IndexInfo rows and/or grouped indexes */
  indexes: readonly AiIndexMeta[];
  /** Column names commonly used in WHERE / filters */
  filterColumns?: readonly string[];
  /** Column names commonly used in ORDER BY */
  orderColumns?: readonly string[];
}

const indexedColumnSets = (indexes: readonly AiIndexMeta[]): Set<string>[] => {
  const sets: Set<string>[] = [];
  for (const idx of indexes) {
    if (idx.columns?.length) {
      sets.push(new Set(idx.columns.map((c) => c.toLowerCase())));
      continue;
    }
    if (idx.column_name) {
      sets.push(new Set([idx.column_name.toLowerCase()]));
    }
  }
  return sets;
};

const isColumnIndexed = (columnName: string, indexedSets: Set<string>[]): boolean => {
  const lower = columnName.toLowerCase();
  return indexedSets.some((set) => set.has(lower));
};

const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`;

const buildCreateIndexSql = (schema: string, table: string, columns: string[]): string => {
  const indexName = `idx_${table}_${columns.join("_")}`.slice(0, 63);
  const cols = columns.map(quoteIdent).join(", ");
  return `CREATE INDEX ${quoteIdent(indexName)} ON ${quoteIdent(schema)}.${quoteIdent(table)} (${cols});`;
};

/**
 * Heuristic missing-index suggestions (no LLM).
 * - FK columns without any index covering that column
 * - Filter / order columns from usage hints without an index
 * Skips primary-key columns (assumed indexed).
 */
export const suggestMissingIndexes = (input: SuggestMissingIndexesInput): IndexSuggestion[] => {
  const { schema, table, columns, indexes, filterColumns = [], orderColumns = [] } = input;
  const indexedSets = indexedColumnSets(indexes);
  const suggestions: IndexSuggestion[] = [];
  const seen = new Set<string>();

  const push = (cols: string[], reason: IndexSuggestionReason, message: string) => {
    const key = `${reason}:${cols.map((c) => c.toLowerCase()).join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({
      columns: cols,
      reason,
      message,
      createSql: buildCreateIndexSql(schema, table, cols),
    });
  };

  for (const col of columns) {
    if (col.primaryKey) continue;
    if (!col.isForeignKey) continue;
    if (isColumnIndexed(col.name, indexedSets)) continue;
    push(
      [col.name],
      "foreign_key",
      `Foreign key column "${col.name}" has no index — joins and lookups may be slow.`,
    );
  }

  for (const name of filterColumns) {
    const col = columns.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!col || col.primaryKey) continue;
    if (isColumnIndexed(col.name, indexedSets)) continue;
    push([col.name], "filter_usage", `Column "${col.name}" appears in filters but has no index.`);
  }

  for (const name of orderColumns) {
    const col = columns.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!col || col.primaryKey) continue;
    if (isColumnIndexed(col.name, indexedSets)) continue;
    push([col.name], "order_usage", `Column "${col.name}" is used for ordering but has no index.`);
  }

  return suggestions;
};
