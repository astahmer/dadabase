import type { ChatDataAccess } from "./chat-data-access.ts";

export type ChatContextAttachment =
  | {
      kind: "table";
      schema?: string;
      table: string;
    }
  | {
      kind: "filters";
      schema?: string;
      table: string;
      filters: readonly Record<string, unknown>[];
    }
  | {
      kind: "selection";
      schema?: string;
      table: string;
      columns: readonly string[];
      rowIds?: readonly string[];
      rows?: readonly Record<string, unknown>[];
    }
  | {
      kind: "sql";
      sql: string;
      source: "editor" | "result" | "assistant";
    }
  | {
      kind: "result";
      columns: readonly string[];
      rowCount: number;
      rows?: readonly Record<string, unknown>[];
    };

/** Persisted receipt shape: describes context without retaining its values. */
export type ChatContextAttachmentReceipt =
  | { kind: "table"; schema?: string; table: string }
  | { kind: "filters"; schema?: string; table: string; filterCount: number }
  | {
      kind: "selection";
      schema?: string;
      table: string;
      columns: readonly string[];
      rowCount: number;
      rowIdsCount: number;
      valuesShared: boolean;
    }
  | { kind: "sql"; source: "editor" | "result" | "assistant"; characterCount: number }
  | { kind: "result"; columns: readonly string[]; rowCount: number; valuesShared: boolean };

export const MAX_CONTEXT_ROWS = 50;
export const MAX_CONTEXT_SQL_LENGTH = 20_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

const boundedRows = (
  rows: readonly Record<string, unknown>[] | undefined,
): readonly Record<string, unknown>[] | undefined =>
  rows === undefined ? undefined : rows.slice(0, MAX_CONTEXT_ROWS);

/**
 * Keep context payloads small and enforce the same row/result disclosure gates
 * on both the browser and the API. The API repeats this sanitization because
 * browser payloads are untrusted.
 */
export const sanitizeChatContextAttachments = (
  input: readonly ChatContextAttachment[] | undefined,
  access: ChatDataAccess,
): ChatContextAttachment[] => {
  if (!input) return [];

  return input.flatMap((attachment): ChatContextAttachment[] => {
    if (!isRecord(attachment) || typeof attachment.kind !== "string") return [];
    switch (attachment.kind) {
      case "table": {
        const table = nonEmptyString(attachment.table);
        if (!table) return [];
        const schema = nonEmptyString(attachment.schema);
        return [{ kind: "table" as const, table, ...(schema ? { schema } : {}) }];
      }
      case "filters": {
        const table = nonEmptyString(attachment.table);
        if (!table || !Array.isArray(attachment.filters)) return [];
        const schema = nonEmptyString(attachment.schema);
        const filters = attachment.filters.filter(isRecord).slice(0, 25);
        return [
          {
            kind: "filters" as const,
            table,
            filters,
            ...(schema ? { schema } : {}),
          },
        ];
      }
      case "selection": {
        const table = nonEmptyString(attachment.table);
        if (!table || !Array.isArray(attachment.columns)) return [];
        const schema = nonEmptyString(attachment.schema);
        const columns = attachment.columns.filter(
          (column): column is string => typeof column === "string",
        );
        const rowIds = Array.isArray(attachment.rowIds)
          ? attachment.rowIds.filter((rowId): rowId is string => typeof rowId === "string")
          : undefined;
        const rows =
          access.sampleRows && Array.isArray(attachment.rows)
            ? boundedRows(attachment.rows.filter(isRecord))
            : undefined;
        return [
          {
            kind: "selection" as const,
            table,
            columns,
            ...(rowIds && rowIds.length > 0 ? { rowIds } : {}),
            ...(rows && rows.length > 0 ? { rows } : {}),
            ...(schema ? { schema } : {}),
          },
        ];
      }
      case "sql": {
        const sql = nonEmptyString(attachment.sql);
        if (!sql) return [];
        const source = attachment.source;
        if (source !== "editor" && source !== "result" && source !== "assistant") return [];
        return [{ kind: "sql" as const, sql: sql.slice(0, MAX_CONTEXT_SQL_LENGTH), source }];
      }
      case "result": {
        if (!Array.isArray(attachment.columns)) return [];
        const columns = attachment.columns.filter(
          (column): column is string => typeof column === "string",
        );
        const rowCount =
          typeof attachment.rowCount === "number" && Number.isFinite(attachment.rowCount)
            ? Math.max(0, Math.floor(attachment.rowCount))
            : 0;
        const rows =
          access.queryResults && Array.isArray(attachment.rows)
            ? boundedRows(attachment.rows.filter(isRecord))
            : undefined;
        return [
          {
            kind: "result" as const,
            columns,
            rowCount,
            ...(rows && rows.length > 0 ? { rows } : {}),
          },
        ];
      }
      default:
        return [];
    }
  });
};

export const dataClassesForChatContext = (
  attachments: readonly ChatContextAttachment[],
): Array<"schema" | "sample-rows" | "query-results"> => {
  const classes = new Set<"schema" | "sample-rows" | "query-results">();
  for (const attachment of attachments) {
    if (attachment.kind === "selection" && attachment.rows?.length) classes.add("sample-rows");
    if (attachment.kind === "result" && attachment.rows?.length) classes.add("query-results");
    if (attachment.kind !== "result" || !attachment.rows?.length) classes.add("schema");
  }
  return [...classes];
};

export const summarizeChatContextAttachments = (
  attachments: readonly ChatContextAttachment[],
): ChatContextAttachmentReceipt[] =>
  attachments.map((attachment) => {
    switch (attachment.kind) {
      case "table":
        return {
          kind: "table",
          ...(attachment.schema ? { schema: attachment.schema } : {}),
          table: attachment.table,
        };
      case "filters":
        return {
          kind: "filters",
          ...(attachment.schema ? { schema: attachment.schema } : {}),
          table: attachment.table,
          filterCount: attachment.filters.length,
        };
      case "selection":
        return {
          kind: "selection",
          ...(attachment.schema ? { schema: attachment.schema } : {}),
          table: attachment.table,
          columns: attachment.columns,
          rowCount: attachment.rows?.length ?? 0,
          rowIdsCount: attachment.rowIds?.length ?? 0,
          valuesShared: Boolean(attachment.rows?.length),
        };
      case "sql":
        return { kind: "sql", source: attachment.source, characterCount: attachment.sql.length };
      case "result":
        return {
          kind: "result",
          columns: attachment.columns,
          rowCount: attachment.rowCount,
          valuesShared: Boolean(attachment.rows?.length),
        };
    }
  });

export const serializeChatContextAttachments = (
  attachments: readonly ChatContextAttachment[],
): string => JSON.stringify(attachments);

export const chatContextAttachmentKey = (attachment: ChatContextAttachment): string =>
  JSON.stringify(attachment);
