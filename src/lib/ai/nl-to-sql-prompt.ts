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
    "- Always include a safe LIMIT (≤ 100) unless the user explicitly asks for more rows, ALL rows, or a different limit.",
    "- Never invent columns or tables that are not listed.",
    "- PostgreSQL / MySQL GROUP BY: every non-aggregated SELECT expression must appear in GROUP BY (or wrap it in an aggregate). Prefer aggregating measures (SUM/MAX) over adding every column to GROUP BY.",
    "- Prefer simple joins; avoid selecting bare columns from both sides of a join under GROUP BY unless they are grouping keys.",
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

/**
 * System prompt for the tool-based chat assistant (streamText + propose_sql/run_sql).
 * Schema blocks are reused from the NL→SQL builder; the model must propose SQL via
 * the `propose_sql` tool and can only execute through the approval-gated `run_sql`.
 * `enabledTools` drops the instructions for tools the user disabled — the model is
 * never told about a tool it cannot call.
 */
export const buildChatSystemPrompt = (input: {
  schema?: AiSchemaContext;
  table?: AiTableContext;
  /** Absent/empty → treat as all tools enabled (matches server default). */
  enabledTools?: readonly string[];
}): string => {
  const enabled = input.enabledTools;
  // undefined = not specified (server default: all tools). An explicit EMPTY
  // array means "select none" — every tool line must be dropped.
  const hasTool = (id: string): boolean => enabled === undefined || enabled.includes(id);
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
    "You are a SQL assistant embedded in dadabase, a database exploration UI.",
    `Dialect: ${dialect}. Schema: ${quoteIdent(schemaName, dialect)}.`,
    "",
    "Workflow:",
    `1. Answer questions in plain language.${hasTool("propose_sql") ? " When the user wants query results or a SQL statement, ALWAYS create it with the `propose_sql` tool (never write SQL as plain text)." : ""}`,
    ...(hasTool("run_sql")
      ? [
            "2. Only call `run_sql` when the user explicitly asked you to run/execute the query — it requires user approval and will pause until they approve.",
            "3. After a successful run_sql, summarize the result rows briefly; do not repeat full row dumps.",
          ]
      : []),
    ...(hasTool("preview_rows")
      ? [
            "- When unsure about column contents or value formats, call `preview_rows` on the table first instead of guessing.",
          ]
      : []),
    ...(hasTool("table_details")
      ? [
            "- When you need key/index/FK detail beyond the schema above, call `table_details` for that specific table.",
          ]
      : []),
    ...(hasTool("explain_sql")
      ? [
            "- For expensive-looking scans or joins, call `explain_sql` before `propose_sql` and mention any red flags in your explanation.",
          ]
      : []),
    ...(hasTool("open_workspace_view")
      ? [
            "- When the user wants to explore/filter a table interactively rather than get an answer, call `open_workspace_view`; they will click a card to open it.",
          ]
      : []),
    "",
    "SQL rules:",
    "- Prefer read-only SELECT/WITH queries.",
    "- Use FK metadata to pick join keys; never invent tables or columns.",
    `- The user currently has ${activeTable ? `table ${quoteIdent(activeTable, dialect)} open` : "no specific table open"} — prefer it when ambiguous.`,
    "- Always include a safe LIMIT (≤ 100) unless the user explicitly asks otherwise.",
    "- PostgreSQL / MySQL GROUP BY: every non-aggregated SELECT expression must appear in GROUP BY (or be wrapped in an aggregate).",
    "",
    "Database schema:",
    schemaBlocks,
  ].join("\n");
};

export const extractSqlFromModelText = (text: string): string => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  // Drop a leading "SQL:" label if present
  return trimmed.replace(/^sql\s*:\s*/i, "").trim();
};
