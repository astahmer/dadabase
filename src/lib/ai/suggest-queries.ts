import type { AiColumnMeta, AiTableContext } from "./ai-types.ts";

export interface SuggestedQuery {
  /** Short label for the UI */
  title: string;
  /** Natural-language prompt (also useful for NL→SQL) */
  prompt: string;
  /** Ready-to-run SELECT */
  sql: string;
  kind: "distinct_enum" | "count_by" | "recent_rows" | "count_all" | "null_check";
}

const ENUMISH_NAME = /^(status|state|type|kind|role|category|visibility|level|phase)$/i;
const TIMESTAMPISH_NAME = /^(created_at|updated_at|inserted_at|modified_at|timestamp|ts)$/i;
const TIMESTAMPISH_TYPE = /timestamp|datetime|date/i;

const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`;

const qualifiedTable = (ctx: AiTableContext): string =>
  `${quoteIdent(ctx.schema)}.${quoteIdent(ctx.table)}`;

const isEnumLike = (col: AiColumnMeta): boolean => {
  if (col.isEnum) return true;
  if (col.primaryKey) return false;
  if (ENUMISH_NAME.test(col.name)) return true;
  return false;
};

const findTimestampColumn = (columns: readonly AiColumnMeta[]): AiColumnMeta | undefined =>
  columns.find((c) => TIMESTAMPISH_NAME.test(c.name) || TIMESTAMPISH_TYPE.test(c.dataType));

/**
 * Generate 3–5 example SELECT prompts from schema metadata.
 * Pure function — no network / LLM.
 */
export const suggestQueriesFromSchema = (table: AiTableContext): SuggestedQuery[] => {
  const out: SuggestedQuery[] = [];
  const qt = qualifiedTable(table);

  out.push({
    kind: "count_all",
    title: "Count all rows",
    prompt: `How many rows are in ${table.schema}.${table.table}?`,
    sql: `SELECT COUNT(*) AS count FROM ${qt};`,
  });

  const enumLike = table.columns.filter(isEnumLike).slice(0, 2);
  for (const col of enumLike) {
    const colQ = quoteIdent(col.name);
    out.push({
      kind: "distinct_enum",
      title: `Distinct ${col.name}`,
      prompt: `What are the distinct values of ${col.name}?`,
      sql: `SELECT DISTINCT ${colQ} FROM ${qt} ORDER BY ${colQ} LIMIT 100;`,
    });
    out.push({
      kind: "count_by",
      title: `Count by ${col.name}`,
      prompt: `Count rows grouped by ${col.name}`,
      sql: `SELECT ${colQ}, COUNT(*) AS count FROM ${qt} GROUP BY ${colQ} ORDER BY count DESC LIMIT 50;`,
    });
  }

  const ts = findTimestampColumn(table.columns);
  if (ts) {
    const colQ = quoteIdent(ts.name);
    out.push({
      kind: "recent_rows",
      title: `Recent by ${ts.name}`,
      prompt: `Show the 50 most recent rows ordered by ${ts.name}`,
      sql: `SELECT * FROM ${qt} ORDER BY ${colQ} DESC LIMIT 50;`,
    });
  }

  const nullable = table.columns.find((c) => c.nullable && !c.primaryKey);
  if (nullable && out.length < 5) {
    const colQ = quoteIdent(nullable.name);
    out.push({
      kind: "null_check",
      title: `Rows with null ${nullable.name}`,
      prompt: `Find rows where ${nullable.name} is null`,
      sql: `SELECT * FROM ${qt} WHERE ${colQ} IS NULL LIMIT 100;`,
    });
  }

  return out.slice(0, 5);
};
