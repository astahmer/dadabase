export type ForeignKeyOnDeleteAction =
  | "CASCADE"
  | "SET NULL"
  | "SET DEFAULT"
  | "RESTRICT"
  | "NO ACTION";

export interface ForeignKeyEdge {
  /** Child table holding the foreign key columns. */
  fromTable: string;
  fromCols: readonly string[];
  /** Parent table referenced by the foreign key. */
  toTable: string;
  toCols: readonly string[];
  onDelete: ForeignKeyOnDeleteAction;
}

export type CascadeAffectedAction = "cascade-delete" | "set-null" | "restrict";

export interface CascadeAffectedTable {
  table: string;
  /** Distance from the root table being deleted (1 = direct child). */
  depth: number;
  action: CascadeAffectedAction;
  /** The table this edge points to (the parent, one hop closer to the root). */
  viaTable: string;
  edge: ForeignKeyEdge;
  /**
   * When available, how many child rows match the selected parent keys for this edge.
   * `null` means count was not computed (e.g. transitive hop); `undefined` means not requested.
   */
  dependentRowCount?: number | null;
}

export interface CascadeDeletePreviewInput {
  edges: readonly ForeignKeyEdge[];
  rootTable: string;
  /** Rows selected for deletion in `rootTable` — only their count is used in the preview. */
  selectedRows?: readonly Record<string, unknown>[];
}

export interface CascadeDeletePreview {
  rootTable: string;
  selectedCount: number;
  /** Tables reachable from the root via foreign keys, deepest cascades first, root last. */
  affected: CascadeAffectedTable[];
  /** Suggested delete order: cascaded child tables (deepest first), then the root table. */
  order: string[];
  /** True when at least one reachable edge would RESTRICT/block the delete. */
  blocked: boolean;
  blockedBy: CascadeAffectedTable[];
}

function normalizeAction(onDelete: ForeignKeyOnDeleteAction): CascadeAffectedAction {
  if (onDelete === "CASCADE") return "cascade-delete";
  if (onDelete === "SET NULL" || onDelete === "SET DEFAULT") return "set-null";
  return "restrict"; // RESTRICT, NO ACTION
}

/**
 * Pure graph walk over a foreign-key edge list: given a root table and the on-delete
 * action of every edge, determines which tables would be cascade-deleted, which rows
 * would be nulled out, and which edges would block (RESTRICT/NO ACTION) the delete.
 * Does not query a database — it is a structural preview only.
 */
export function buildCascadeDeletePreview(input: CascadeDeletePreviewInput): CascadeDeletePreview {
  const { edges, rootTable, selectedRows = [] } = input;

  const childEdgesByParent = new Map<string, ForeignKeyEdge[]>();
  for (const edge of edges) {
    const list = childEdgesByParent.get(edge.toTable) ?? [];
    list.push(edge);
    childEdgesByParent.set(edge.toTable, list);
  }

  const affected: CascadeAffectedTable[] = [];
  const blockedBy: CascadeAffectedTable[] = [];
  const visited = new Set<string>([rootTable]);

  let frontier = [rootTable];
  let depth = 1;
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const parent of frontier) {
      for (const edge of childEdgesByParent.get(parent) ?? []) {
        const action = normalizeAction(edge.onDelete);
        const entry: CascadeAffectedTable = {
          table: edge.fromTable,
          depth,
          action,
          viaTable: parent,
          edge,
        };
        affected.push(entry);

        if (action === "restrict") {
          blockedBy.push(entry);
          continue;
        }
        if (action === "cascade-delete" && !visited.has(edge.fromTable)) {
          visited.add(edge.fromTable);
          nextFrontier.push(edge.fromTable);
        }
      }
    }
    frontier = nextFrontier;
    depth += 1;
  }

  const cascadedTables: string[] = [];
  const seen = new Set<string>();
  for (const entry of [...affected].sort((a, b) => b.depth - a.depth)) {
    if (entry.action !== "cascade-delete" || entry.table === rootTable || seen.has(entry.table))
      continue;
    seen.add(entry.table);
    cascadedTables.push(entry.table);
  }

  return {
    rootTable,
    selectedCount: selectedRows.length,
    affected,
    order: [...cascadedTables, rootTable],
    blocked: blockedBy.length > 0,
    blockedBy,
  };
}

/**
 * Merges optional per-table dependent row counts into a structural cascade preview.
 * Counts keyed by child table name; missing keys leave `dependentRowCount` as `null`.
 */
export function withDependentRowCounts(
  preview: CascadeDeletePreview,
  countsByTable: Readonly<Record<string, number | null | undefined>>,
): CascadeDeletePreview {
  const attach = (entry: CascadeAffectedTable): CascadeAffectedTable => ({
    ...entry,
    dependentRowCount:
      entry.table in countsByTable ? (countsByTable[entry.table] ?? null) : (entry.dependentRowCount ?? null),
  });
  return {
    ...preview,
    affected: preview.affected.map(attach),
    blockedBy: preview.blockedBy.map(attach),
  };
}
