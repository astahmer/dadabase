import type { AiColumnMeta, AiTableContext } from "./ai-types.ts";

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

export interface BuildNlToSqlPromptInput {
  question: string;
  table: AiTableContext;
}

/**
 * Pure prompt builder for NL → SQL. No network.
 * Model should return a single SELECT (or WITH … SELECT) statement.
 */
export const buildNlToSqlPrompt = (input: BuildNlToSqlPromptInput): string => {
  const { question, table } = input;
  const qualified = `${quoteIdent(table.schema, table.dialect)}.${quoteIdent(table.table, table.dialect)}`;
  const columnBlock = table.columns.map(formatColumnLine).join("\n");

  return [
    "You are a SQL expert helping explore a database in dadabase.",
    `Dialect: ${table.dialect ?? "postgres"}.`,
    "Generate ONE read-only SQL query (SELECT or WITH … SELECT) that answers the user question.",
    "Rules:",
    "- Output ONLY the SQL statement — no markdown fences, no commentary.",
    "- Prefer the given table; join other tables only when FK metadata makes it clear.",
    "- Qualify columns with the table name when ambiguous.",
    "- Use LIMIT 100 unless the user asks for aggregates or a different limit.",
    "- Never invent columns that are not listed.",
    "",
    `Table: ${qualified}`,
    "Columns:",
    columnBlock || "(no columns)",
    "",
    `User question: ${question.trim()}`,
  ].join("\n");
};

/** Strip markdown fences / leading labels from a model SQL response. */
export const extractSqlFromModelText = (text: string): string => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  // Drop a leading "SQL:" label if present
  return trimmed.replace(/^sql\s*:\s*/i, "").trim();
};
