import type { AiSchemaContext, AiTableContext } from "./ai-types.ts";

/**
 * Auto schema selection: one lightweight model call that picks the tables the
 * question actually needs, so the main streaming prompt stays small.
 * Pure functions here — the route owns the real generateText call and passes
 * its output in, keeping this unit-testable without a provider.
 */

/** Compact one-line-per-table summary: `name(col1,col2,…)` — no types/flags. */
export const buildAutoSelectPrompt = (tables: readonly AiTableContext[]): string => {
  const summary = tables
    .map((table) => {
      const columns = table.columns.map((col) => col.name).join(",");
      return `- ${table.table}(${columns})`;
    })
    .join("\n");
  return [
    "You help a SQL assistant pick relevant database tables.",
    "Given the user question and a table list (name(columns)), reply with a JSON array",
    "of ONLY the table names needed to answer the question. No commentary, no fences.",
    "Include tables required for joins via foreign keys. When in doubt, include fewer tables.",
    "",
    "Tables:",
    summary,
  ].join("\n");
};

/**
 * Parse the model's reply into valid known table names:
 * - accepts raw JSON arrays or JSON fenced in ```…```;
 * - drops unknown/duplicate names, preserves `known` order;
 * - returns null for garbage (caller falls back to all tables).
 */
export const parseAutoSelectedTables = (
  raw: string,
  knownTables: readonly string[],
): string[] | null => {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced?.[1] ?? raw).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Tolerate a bare comma-separated fallback like: users, orders
    if (/^[A-Za-z0-9_"',\s]+$/.test(text)) {
      parsed = text.split(",").map((part) => part.trim().replaceAll('"', ""));
    } else {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  if (parsed.some((entry) => typeof entry !== "string")) return null;
  const wanted = new Set(parsed as string[]);
  return knownTables.filter((name) => wanted.has(name));
};

export interface ResolveAutoTablesInput {
  /** Model reply text from the lightweight pre-request. */
  reply: string;
  schema: AiSchemaContext;
}

/**
 * Apply a parsed auto-selection to the schema. Falls back to the full schema
 * when the reply is garbage or selects nothing usable.
 */
export const applyAutoSelection = ({ reply, schema }: ResolveAutoTablesInput): AiSchemaContext => {
  const known = schema.tables.map((table) => table.table);
  const picked = parseAutoSelectedTables(reply, known);
  if (picked === null || picked.length === 0) return schema;
  const wanted = new Set(picked);
  return { ...schema, tables: schema.tables.filter((table) => wanted.has(table.table)) };
};
