import type { AiColumnMeta, AiSchemaContext, AiTableContext } from "./ai-types.ts";

const quoteIdent = (name: string, dialect?: string): string => {
  if (dialect === "sqlite") return `"${name.replaceAll('"', '""')}"`;
  return `"${name.replaceAll('"', '""')}"`;
};

const formatColumnLine = (col: AiColumnMeta): string => {
  const flags: string[] = [];
  if (col.primaryKey) flags.push("PK");
  if (col.unique) flags.push("UNIQUE");
  if (col.nullable) flags.push("NULL");
  else flags.push("NOT NULL");
  if (col.isForeignKey && col.foreignKey) {
    flags.push(
      `FK→${col.foreignKey.referencedSchema}.${col.foreignKey.referencedTable}.${col.foreignKey.referencedColumn}`,
    );
  }
  if (col.isEnum && col.enumValues?.length) {
    flags.push(`ENUM(${col.enumValues.join("|")})`);
  }
  return `- ${col.name} ${col.dataType} [${flags.join(", ")}]`;
};

const formatTableBlock = (table: AiTableContext): string => {
  const qualified = `${quoteIdent(table.schema, table.dialect)}.${quoteIdent(table.table, table.dialect)}`;
  const columnBlock = table.columns.map(formatColumnLine).join("\n");
  return [`Table: ${qualified}`, "Columns:", columnBlock || "(no columns)"].join("\n");
};

export interface BuildNlToSqlPromptInput {
  question: string;
  /**
   * Prefer full schema. Single-table `table` kept for back-compat / focused hints.
   */
  schema?: AiSchemaContext;
  /** @deprecated Prefer `schema` with all tables */
  table?: AiTableContext;
}

/**
 * Pure prompt builder for NL → SQL. No network.
 * Model should return a single SELECT (or WITH … SELECT) statement.
 * Uses the whole database schema when provided — not only the active table.
 */
export const buildNlToSqlPrompt = (input: BuildNlToSqlPromptInput): string => {
  const { question } = input;
  const dialect =
    input.schema?.dialect ?? input.table?.dialect ?? input.schema?.tables[0]?.dialect ?? "postgres";
  const schemaName = input.schema?.schema ?? input.table?.schema ?? "public";
  const tables: AiTableContext[] = input.schema?.tables?.length
    ? [...input.schema.tables]
    : input.table
      ? [input.table]
      : [];

  const activeTable = input.schema?.activeTable ?? input.table?.table;
  const schemaBlocks =
    tables.length > 0
      ? tables.map(formatTableBlock).join("\n\n")
      : `(no tables in schema ${quoteIdent(schemaName, dialect)})`;

  return [
    "You are a SQL expert helping explore a database in dadabase.",
    `Dialect: ${dialect}.`,
    `Schema: ${quoteIdent(schemaName, dialect)}.`,
    "Generate ONE read-only SQL query (SELECT or WITH … SELECT) that answers the user question.",
    "Rules:",
    "- Output ONLY the SQL statement — no markdown fences, no commentary.",
    "- You have the FULL database schema below. Join across tables when the question needs it.",
    "- Use FK metadata to pick join keys; do not invent relationships.",
    activeTable
      ? `- The user currently has table ${quoteIdent(activeTable, dialect)} open — prefer it when the question is ambiguous, but still use other tables when needed.`
      : "- No active table hint; pick the best tables from the schema.",
    "- Qualify columns with the table name when ambiguous.",
    "- Use LIMIT 100 unless the user asks for aggregates or a different limit.",
    "- Never invent columns or tables that are not listed.",
    "",
    "Database schema:",
    schemaBlocks,
    "",
    `User question: ${question.trim()}`,
  ].join("\n");
};

export interface BuildNlToSqlChatPromptInput extends BuildNlToSqlPromptInput {
  /** Prior turns (user/assistant), oldest first. Assistant content may include SQL. */
  history?: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
}

/**
 * Multi-turn chat prompt: includes prior Q/A then the latest question.
 * Same output rules as `buildNlToSqlPrompt` (SQL only).
 */
export const buildNlToSqlChatPrompt = (input: BuildNlToSqlChatPromptInput): string => {
  const base = buildNlToSqlPrompt(input);
  const history = input.history ?? [];
  if (history.length === 0) return base;

  const historyBlock = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`)
    .join("\n\n");

  return [
    base,
    "",
    "Conversation so far (for context; still output ONLY SQL for the latest question):",
    historyBlock,
  ].join("\n");
};
export const extractSqlFromModelText = (text: string): string => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  // Drop a leading "SQL:" label if present
  return trimmed.replace(/^sql\s*:\s*/i, "").trim();
};
