export interface SqliteExplainRow {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

export interface SqliteExplainNode extends SqliteExplainRow {
  /** Depth in the plan tree, derived by walking `parent` links (root nodes are level 0). */
  level: number;
  children: SqliteExplainNode[];
}

/**
 * Parses `EXPLAIN QUERY PLAN` rows into `{ id, parent, notused, detail }` records.
 * Accepts either driver row objects or `id|parent|notused|detail` pipe-delimited text
 * (as produced by the `sqlite3` CLI in `.mode list` with the default `|` separator).
 */
export function parseSqliteExplainRows(
  input: string | ReadonlyArray<Record<string, unknown>>,
): SqliteExplainRow[] {
  if (typeof input === "string") {
    return input
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && line.toUpperCase() !== "QUERY PLAN")
      .map((line) => {
        const parts = line.split("|");
        const [id, parent, notused, ...rest] = parts;
        return {
          id: Number(id ?? 0),
          parent: Number(parent ?? 0),
          notused: Number(notused ?? 0),
          detail: rest.join("|").trim(),
        };
      });
  }

  return input.map((row) => ({
    id: Number(row.id ?? 0),
    parent: Number(row.parent ?? 0),
    notused: Number(row.notused ?? 0),
    detail: String(row.detail ?? ""),
  }));
}

/** Builds a parent/child tree (in original row order) from flat explain rows. */
export function buildSqliteExplainTree(rows: readonly SqliteExplainRow[]): SqliteExplainNode[] {
  const nodesById = new Map<number, SqliteExplainNode>();
  const roots: SqliteExplainNode[] = [];

  for (const row of rows) {
    nodesById.set(row.id, { ...row, level: 0, children: [] });
  }

  for (const row of rows) {
    const node = nodesById.get(row.id)!;
    const parent = row.parent !== 0 ? nodesById.get(row.parent) : undefined;
    if (parent) {
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Flattens a tree back into depth-first order, useful for simple list rendering. */
export function flattenSqliteExplainTree(nodes: readonly SqliteExplainNode[]): SqliteExplainNode[] {
  const flat: SqliteExplainNode[] = [];
  const visit = (node: SqliteExplainNode) => {
    flat.push(node);
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return flat;
}

/** Parses raw `EXPLAIN QUERY PLAN` output (text or rows) directly into a plan tree. */
export function parseSqliteExplain(
  input: string | ReadonlyArray<Record<string, unknown>>,
): SqliteExplainNode[] {
  return buildSqliteExplainTree(parseSqliteExplainRows(input));
}
