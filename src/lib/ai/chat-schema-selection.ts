import type { AiSchemaContext } from "./ai-types.ts";

/**
 * Which tables ride along as schema context in chat requests.
 * - "all": every table (default; matches the historical behavior).
 * - "selected": only the user-checked tables (client-side filter).
 * - "auto": the full table list is sent to /api/chat, which first runs one
 *   lightweight model call to pick the needed subset before the main stream.
 */
export type ChatSchemaMode = "all" | "selected" | "auto";

export const CHAT_SCHEMA_MODES: ChatSchemaMode[] = ["all", "selected", "auto"];

export interface StoredChatSchemaSelection {
  mode: ChatSchemaMode;
  /** Table names for "selected" mode. Unknown names are ignored at filter time. */
  selectedTables?: string[];
}

const DEFAULT_SELECTION: StoredChatSchemaSelection = { mode: "all" };

const storageKey = (connectionName: string): string =>
  `dadabase.chat.schema-selection.${connectionName}`;

/** Fired after the selection UI saves; the runtime re-reads storage per request. */
export const SCHEMA_SELECTION_CHANGED_EVENT = "dadabase:schema-selection-changed";

export const normalizeChatSchemaMode = (value: unknown): ChatSchemaMode =>
  typeof value === "string" && (CHAT_SCHEMA_MODES as string[]).includes(value)
    ? (value as ChatSchemaMode)
    : "all";

export const getStoredChatSchemaSelection = (
  connectionName: string,
): StoredChatSchemaSelection => {
  if (typeof window === "undefined") return DEFAULT_SELECTION;
  try {
    const raw = window.localStorage.getItem(storageKey(connectionName));
    if (!raw) return DEFAULT_SELECTION;
    const parsed = JSON.parse(raw) as Partial<StoredChatSchemaSelection>;
    return {
      mode: normalizeChatSchemaMode(parsed.mode),
      ...(Array.isArray(parsed.selectedTables)
        ? {
            selectedTables: parsed.selectedTables.filter(
              (name): name is string => typeof name === "string",
            ),
          }
        : {}),
    };
  } catch {
    return DEFAULT_SELECTION;
  }
};

export const setStoredChatSchemaSelection = (
  connectionName: string,
  selection: StoredChatSchemaSelection,
): void => {
  window.localStorage.setItem(storageKey(connectionName), JSON.stringify(selection));
};

/**
 * Pure filter for "selected" mode: keeps only known table names, in schema
 * order. An explicit empty list stays empty — the prompt will say no tables
 * are listed (the UI shows a live count so this state is visible).
 */
export const applySelectedTables = (
  schema: AiSchemaContext,
  selectedTables: readonly string[] | undefined,
): AiSchemaContext => {
  if (!Array.isArray(selectedTables) || selectedTables.length === 0) {
    return { ...schema, tables: [] };
  }
  const wanted = new Set(selectedTables);
  return { ...schema, tables: schema.tables.filter((table) => wanted.has(table.table)) };
};

/**
 * Resolve what the client should send for the stored selection:
 * - all → schema unchanged, no mode flag;
 * - selected → filtered schema client-side (smaller payload), no mode flag;
 * - auto → full schema + `schemaMode: "auto"`; the server picks the subset
 *   with one lightweight call before the main completion.
 */
export const resolveSchemaRequestParts = (
  schemaContext: AiSchemaContext | undefined,
  selection: StoredChatSchemaSelection,
): { schemaContext?: AiSchemaContext; schemaMode?: ChatSchemaMode } => {
  if (schemaContext === undefined) return {};
  switch (selection.mode) {
    case "selected":
      return {
        schemaContext: applySelectedTables(schemaContext, selection.selectedTables),
      };
    case "auto":
      return { schemaContext, schemaMode: "auto" };
    default:
      return { schemaContext };
  }
};

/** Header the /api/chat route uses to report the auto-mode resolution result. */
export const AUTO_SCHEMA_HEADER = "x-dadabase-schema-tables";

let lastResolvedAutoTables: string[] | null = null;

/** Fired whenever a response carries a fresh auto-mode resolution. */
export const SCHEMA_RESOLVED_EVENT = "dadabase:schema-resolved";

export const recordResolvedAutoTables = (tables: string[]): void => {
  lastResolvedAutoTables = tables;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SCHEMA_RESOLVED_EVENT));
  }
};

export const getLastResolvedAutoTables = (): string[] | null => lastResolvedAutoTables;
