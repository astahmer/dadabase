/**
 * Data-driven registry of tools the chat assistant can register server-side.
 * The settings UI renders this list; the /api/chat route registers only the
 * enabled subset and the system prompt drops instructions for disabled tools.
 */
export const CHAT_TOOLS = [
  {
    id: "propose_sql",
    label: "Propose SQL",
    description: "Draft SQL from natural language. It never runs by itself.",
    dataClass: "schema",
  },
  {
    id: "run_sql",
    label: "Run SQL",
    description: "Run approved SQL and optionally share its returned results.",
    dataClass: "query-results",
  },
  {
    id: "open_workspace_view",
    label: "Open workspace view",
    description: "Offer opening a browse tab pre-filtered on a table.",
    dataClass: "schema",
  },
  {
    id: "preview_rows",
    label: "Preview rows",
    description: "Share up to 25 sample rows to understand real values.",
    dataClass: "sample-rows",
  },
  {
    id: "table_details",
    label: "Table details",
    description: "Inspect columns, types, keys and indexes of a table.",
    dataClass: "schema",
  },
  {
    id: "explain_sql",
    label: "Explain SQL",
    description: "Fetch the query plan for a statement before proposing it.",
    dataClass: "schema",
  },
] as const;

export type ChatToolId = (typeof CHAT_TOOLS)[number]["id"];

/** Every known tool id, canonical order. */
export const CHAT_TOOL_IDS: ChatToolId[] = CHAT_TOOLS.map((tool) => tool.id);

/** Default selection: everything enabled. */
export const DEFAULT_ENABLED_CHAT_TOOLS = [...CHAT_TOOL_IDS];

export const isChatToolId = (value: unknown): value is ChatToolId =>
  typeof value === "string" && CHAT_TOOL_IDS.includes(value as ChatToolId);

/**
 * Normalize an arbitrary stored/requested list to a valid enabled set:
 * unknown ids dropped, canonical order, duplicates collapsed. `undefined`
 * (nothing stored) means the default — all tools. An empty array is a
 * legitimate explicit state ("select none") and is preserved.
 */
export const normalizeEnabledChatTools = (value: readonly unknown[] | undefined): ChatToolId[] => {
  if (!Array.isArray(value)) return [...DEFAULT_ENABLED_CHAT_TOOLS];
  return CHAT_TOOL_IDS.filter((id) => value.includes(id));
};
