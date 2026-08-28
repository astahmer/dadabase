import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateText,
  readUIMessageStream,
  stepCountIs,
  streamText,
  tool,
  validateUIMessages,
} from "ai";
import { Effect } from "effect";
import { z } from "zod";

import type { AiSchemaContext } from "#src/lib/ai/ai-types.ts";
import type { ChatAccessMode } from "#src/lib/ai/chat-access-mode.ts";
import type { ChatContextAttachment } from "#src/lib/ai/chat-context.ts";

import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { getDialectDefaultSchema, type DatabaseDialect } from "#src/db/dialect.ts";
import {
  dataClassesForChatContext,
  sanitizeChatContextAttachments,
  summarizeChatContextAttachments,
} from "#src/lib/ai/chat-context.ts";
import {
  applyChatDataAccessToTools,
  dataClassesForChatTurn,
  normalizeChatDataAccess,
} from "#src/lib/ai/chat-data-access.ts";
import { ChatRequestConfigSchema } from "#src/lib/ai/chat-request-config.ts";
import { AUTO_SCHEMA_HEADER } from "#src/lib/ai/chat-schema-selection.ts";
import {
  ExplainSqlInputSchema,
  OpenWorkspaceViewInputSchema,
  PreviewRowsInputSchema,
  TableDetailsInputSchema,
} from "#src/lib/ai/chat-tool-schemas.ts";
import { normalizeEnabledChatTools } from "#src/lib/ai/chat-tools.ts";
import { toJsonSafeValue } from "#src/lib/ai/json-safe-value.ts";
import { buildChatSystemPrompt } from "#src/lib/ai/nl-to-sql-prompt.ts";
import { applyAutoSelection, buildAutoSelectPrompt } from "#src/lib/ai/schema-auto-select.ts";
import { ChatUiMessages } from "#src/lib/chat/chat/ui-messages.ts";
import { isReadOnlyConnection } from "#src/lib/connection-security.ts";
import {
  ChatThreadRepository,
  type UpsertChatMessageInput,
} from "#src/server/chat/chat-thread.repository.ts";
import { withRemoteConnectionLayersFromUrl } from "#src/server/create-remote-server-fn.ts";
import {
  isDestructiveQuery,
  isSelectQuery,
} from "#src/server/introspection/detect-destructive-sql.ts";
import {
  executeCustomSql,
  getTableColumns,
  getTableForeignKeys,
  getTableIndexes,
} from "#src/server/introspection/introspection.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

const MAX_RESULT_ROWS = 50;
const MAX_PREVIEW_ROWS = 25;
const MAX_PREVIEW_RELATIONS = 4;

const DISPLAY_COLUMN_NAMES = [
  "display_name",
  "title",
  "name",
  "channel_name",
  "login",
  "username",
  "label",
  "slug",
] as const;

type ReadableRelation = {
  sourceColumn: string;
  label: string;
  referencedTable: string;
  resolvedCount: number;
  unresolvedCount: number;
  inferred?: boolean;
  labels: Record<string, unknown>;
};

/** Minimal identifier quoting for the preview/explain helpers. */
const quoteToolIdent = (name: string): string =>
  /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;

/** Dialect-aware EXPLAIN prefix; null where the dialect has no EXPLAIN. */
const explainPrefix = (dialect: string): string | null => {
  switch (dialect) {
    case "postgres":
      return "EXPLAIN (FORMAT TEXT) ";
    case "mysql":
      return "EXPLAIN ";
    case "sqlite":
    case "libsql":
      return "EXPLAIN QUERY PLAN ";
    case "duckdb":
      return "EXPLAIN ";
    case "clickhouse":
      return "EXPLAIN ";
    default:
      // mssql, csv (duckdb-backed but plan text is noisy) — skip gracefully.
      return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const chooseDisplayColumn = (
  columns: ReadonlyArray<{ name: string }>,
  referencedColumn: string,
): string | undefined => {
  const byName = new Map(columns.map((column) => [column.name.toLowerCase(), column.name]));
  for (const candidate of DISPLAY_COLUMN_NAMES) {
    const column = byName.get(candidate);
    if (column !== undefined && column !== referencedColumn) return column;
  }
  return columns.find((column) => {
    const name = column.name.toLowerCase();
    return (
      column.name !== referencedColumn &&
      (name.includes("display") ||
        name.includes("title") ||
        name.includes("name") ||
        name.includes("label"))
    );
  })?.name;
};

const sqlLiteral = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replaceAll("'", "''")}'`;
};

const bodySchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
  config: ChatRequestConfigSchema,
  connectionName: z.string().min(1),
  schemaContext: z.custom<AiSchemaContext>((value) => value !== null).optional(),
  threadId: z.string().optional(),
  /** Enabled tools; absent → all. Unknown ids are dropped server-side. */
  enabledTools: z.array(z.string()).optional(),
  /** Row and result sharing can be narrowed independently of SQL access. */
  dataAccess: z
    .object({
      schema: z.boolean(),
      sampleRows: z.boolean(),
      queryResults: z.boolean(),
    })
    .optional(),
  /** Ephemeral workspace context; values are sanitized against dataAccess. */
  contextAttachments: z.array(z.record(z.string(), z.unknown())).optional(),
  /**
   * "auto": one lightweight generateText call first picks the needed tables
   * from the full schema; the main completion then sees only that subset.
   * Absent → use schemaContext as sent ("all"/client-filtered "selected").
   */
  schemaMode: z.enum(["auto"]).optional(),
  accessMode: z.enum(["read-only", "read-write", "full"]).optional(),
});

const resolveConnection = (connectionName: string) =>
  Effect.gen(function* () {
    const repo = yield* DatabaseConnectionRepository;
    const connection = yield* repo.findByName(connectionName);
    if (!connection) throw new Error(`Connection not found: ${connectionName}`);
    return connection;
  });

const runSqlToolExecute = async ({
  sql,
  connectionUrl,
  accessMode = "read-only",
  enforceAccess = true,
  schemaContext,
}: {
  sql: string;
  connectionUrl: string;
  accessMode?: ChatAccessMode;
  enforceAccess?: boolean;
  schemaContext?: AiSchemaContext;
}) => {
  const program = Effect.gen(function* () {
    if (enforceAccess && isReadOnlyConnection(connectionUrl) && !isSelectQuery(sql)) {
      return { ok: false as const, error: "This connection is read-only. Only SELECT queries." };
    }
    if (enforceAccess && !isSelectQuery(sql) && accessMode === "read-only") {
      return { ok: false as const, error: "Read-only AI access only allows SELECT queries." };
    }
    if (enforceAccess && isDestructiveQuery(sql) && accessMode !== "full") {
      return {
        ok: false as const,
        error: "Full Access is required for DELETE and destructive SQL.",
      };
    }
    const result = yield* executeCustomSql({ sql });
    const rows = result.rows.slice(0, MAX_RESULT_ROWS).map((row) => {
      const record: Record<string, unknown> = {};
      for (const col of result.columns) {
        record[col] = (row as Record<string, unknown>)[col];
      }
      return record;
    });
    const readable =
      schemaContext === undefined
        ? undefined
        : yield* enrichReadableResult({ columns: result.columns, rows, schemaContext });
    return toJsonSafeValue({
      sql,
      ok: true as const,
      columns: result.columns,
      rowCount: result.rowCount,
      rowsAffected: result.rowsAffected ?? null,
      truncated: result.rows.length > MAX_RESULT_ROWS,
      rows,
      ...(readable ?? {}),
    });
  }).pipe(withRemoteConnectionLayersFromUrl(connectionUrl));

  return AppRuntime.runPromise(program as never);
};

const enrichReadableResult = ({
  columns,
  rows,
  schemaContext,
}: {
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Record<string, unknown>>;
  schemaContext: AiSchemaContext;
}) =>
  Effect.gen(function* () {
    const candidates = schemaContext.tables.flatMap((table) =>
      table.columns.flatMap((column) =>
        columns.includes(column.name) && column.name.toLowerCase().endsWith("_id")
          ? [{ table, column }]
          : [],
      ),
    );
    const bySource = new Map<string, (typeof candidates)[number]>();
    const ambiguous = new Set<string>();
    for (const candidate of candidates) {
      const source = candidate.column.name;
      if (bySource.has(source)) ambiguous.add(source);
      else bySource.set(source, candidate);
    }
    const relations: ReadableRelation[] = [];
    for (const sourceColumn of bySource.keys()) {
      if (ambiguous.has(sourceColumn)) continue;
      const candidate = bySource.get(sourceColumn);
      const explicitForeignKey = candidate?.column.foreignKey ?? undefined;
      const explicitTarget =
        explicitForeignKey === undefined
          ? undefined
          : schemaContext.tables.find(
              (table) =>
                table.schema === explicitForeignKey.referencedSchema &&
                table.table === explicitForeignKey.referencedTable,
            );
      const sourceBase = sourceColumn.slice(0, -"_id".length).toLowerCase();
      const activeTable = schemaContext.activeTable?.toLowerCase();
      const activePrefix = activeTable?.split("_").slice(0, -1).join("_");
      const inferredTargets = schemaContext.tables
        .filter((table) => table.schema === schemaContext.schema)
        .map((table) => {
          const tableName = table.table.toLowerCase();
          const score =
            tableName === sourceBase
              ? 100
              : activePrefix !== undefined && tableName === `${activePrefix}_${sourceBase}`
                ? 90
                : tableName.endsWith(`_${sourceBase}`)
                  ? 70
                  : 0;
          return { table, score };
        })
        .filter(({ score }) => score > 0)
        .toSorted((a, b) => b.score - a.score);
      const bestInferred = inferredTargets[0];
      const secondInferred = inferredTargets[1];
      const inferredTarget =
        explicitTarget === undefined &&
        bestInferred !== undefined &&
        bestInferred.score > (secondInferred?.score ?? 0)
          ? bestInferred.table
          : undefined;
      const target = explicitTarget ?? inferredTarget;
      if (target === undefined) continue;
      const foreignKey =
        explicitForeignKey ??
        ({
          referencedSchema: target.schema,
          referencedTable: target.table,
          referencedColumn: "id",
        } as const);
      const displayColumn = chooseDisplayColumn(target.columns, foreignKey.referencedColumn);
      if (displayColumn === undefined) continue;
      const keys = [
        ...new Set(
          rows
            .map((row) => row[sourceColumn])
            .filter((value) => value !== null && value !== undefined)
            .map((value) => String(value)),
        ),
      ].slice(0, MAX_PREVIEW_ROWS);
      if (keys.length === 0) continue;
      const targetTable = `${quoteToolIdent(target.schema)}.${quoteToolIdent(target.table)}`;
      const lookup = yield* executeCustomSql({
        sql: `SELECT ${quoteToolIdent(foreignKey.referencedColumn)} AS "key_value", ${quoteToolIdent(displayColumn)} AS "label_value" FROM ${targetTable} WHERE ${quoteToolIdent(foreignKey.referencedColumn)} IN (${keys.map(sqlLiteral).join(", ")}) LIMIT ${MAX_PREVIEW_ROWS}`,
        skipQueryLog: true,
      }).pipe(Effect.catch(() => Effect.succeed({ rows: [] as unknown[] })));
      const labels: Record<string, unknown> = {};
      for (const row of lookup.rows) {
        if (!isRecord(row)) continue;
        const key = row.key_value;
        if (key !== null && key !== undefined) labels[String(key)] = row.label_value;
      }
      relations.push({
        sourceColumn,
        label: displayColumn,
        referencedTable: target.table,
        resolvedCount: keys.filter((key) => Object.hasOwn(labels, key)).length,
        unresolvedCount: keys.filter((key) => !Object.hasOwn(labels, key)).length,
        ...(explicitForeignKey === undefined ? { inferred: true } : {}),
        labels,
      });
    }
    const relationSources = new Set(relations.map((relation) => relation.sourceColumn));
    const preferredColumns = columns.filter(
      (column) =>
        !relationSources.has(column) &&
        DISPLAY_COLUMN_NAMES.includes(
          column.toLowerCase() as (typeof DISPLAY_COLUMN_NAMES)[number],
        ),
    );
    const readableColumns = [
      ...preferredColumns,
      ...relations.map((relation) => `${relation.sourceColumn}__label`),
    ];
    const fallbackColumns = columns.filter((column) => !relationSources.has(column));
    const selectedColumns = (readableColumns.length > 0 ? readableColumns : fallbackColumns).slice(
      0,
      8,
    );
    const readableRows = rows.map((row) => {
      const readable: Record<string, unknown> = {};
      for (const column of selectedColumns) {
        if (!column.endsWith("__label")) readable[column] = row[column];
      }
      for (const relation of relations) {
        const labelColumn = `${relation.sourceColumn}__label`;
        if (selectedColumns.includes(labelColumn)) {
          const key = row[relation.sourceColumn];
          readable[labelColumn] =
            key === null || key === undefined ? null : (relation.labels[String(key)] ?? null);
        }
      }
      return readable;
    });
    return {
      readableColumns: selectedColumns,
      readableRows,
      readableRelations: relations.map(({ labels: _labels, ...relation }) => relation),
    };
  });

/** preview_rows: capped SELECT * over the quoted table. */
const previewRowsToolExecute = async ({
  table,
  schema,
  limit,
  connectionUrl,
  dialect,
}: {
  table: string;
  schema?: string;
  limit: number;
  connectionUrl: string;
  dialect: string;
}) => {
  const qualified = schema
    ? `${quoteToolIdent(schema)}.${quoteToolIdent(table)}`
    : quoteToolIdent(table);
  // DuckDB-backed CSV connections default to main; qualify explicitly there.
  const sql =
    dialect === "duckdb" && !schema
      ? `SELECT * FROM main.${quoteToolIdent(table)} LIMIT ${Math.min(limit, MAX_PREVIEW_ROWS)}`
      : `SELECT * FROM ${qualified} LIMIT ${Math.min(limit, MAX_PREVIEW_ROWS)}`;
  const base = await runSqlToolExecute({ sql, connectionUrl });
  const sourceRows = isRecord(base) && Array.isArray(base.rows) ? base.rows.filter(isRecord) : [];
  const sourceColumns =
    isRecord(base) && Array.isArray(base.columns)
      ? base.columns.filter((column): column is string => typeof column === "string")
      : sourceRows[0]
        ? Object.keys(sourceRows[0])
        : [];
  const readableSourceColumns = sourceColumns.filter((column) =>
    DISPLAY_COLUMN_NAMES.includes(column.toLowerCase() as (typeof DISPLAY_COLUMN_NAMES)[number]),
  );

  // Relation labels are an additive presentation payload. The raw `rows`
  // response remains exactly the sampled SQL result; this bounded lookup only
  // adds friendly labels to the separate preview shown in the UI.
  const sourceSchema = schema ?? getDialectDefaultSchema(dialect as DatabaseDialect);
  const relationLabels: Array<ReadableRelation | null> = await AppRuntime.runPromise(
    Effect.gen(function* () {
      const foreignKeys = yield* getTableForeignKeys({ schema: sourceSchema, table }).pipe(
        Effect.catch(() => Effect.succeed([])),
      );
      const selected = foreignKeys.slice(0, MAX_PREVIEW_RELATIONS);
      return yield* Effect.all(
        selected.map((foreignKey) =>
          Effect.gen(function* () {
            if (!sourceColumns.includes(foreignKey.column_name)) return null;
            const targetColumns = yield* getTableColumns({
              schema: foreignKey.referenced_table_schema,
              table: foreignKey.referenced_table_name,
            }).pipe(Effect.catch(() => Effect.succeed([])));
            const displayColumn = chooseDisplayColumn(
              targetColumns,
              foreignKey.referenced_column_name,
            );
            if (displayColumn === undefined) return null;
            const keys = [
              ...new Set(
                sourceRows
                  .map((row) => row[foreignKey.column_name])
                  .filter((value) => value !== null && value !== undefined)
                  .map((value) => String(value)),
              ),
            ].slice(0, MAX_PREVIEW_ROWS);
            if (keys.length === 0) return null;
            const targetSchema = `${quoteToolIdent(foreignKey.referenced_table_schema)}.`;
            const targetTable = `${targetSchema}${quoteToolIdent(foreignKey.referenced_table_name)}`;
            const lookup = yield* executeCustomSql({
              sql: `SELECT ${quoteToolIdent(foreignKey.referenced_column_name)} AS "key_value", ${quoteToolIdent(displayColumn)} AS "label_value" FROM ${targetTable} WHERE ${quoteToolIdent(foreignKey.referenced_column_name)} IN (${keys.map(sqlLiteral).join(", ")}) LIMIT ${MAX_PREVIEW_ROWS}`,
              skipQueryLog: true,
            }).pipe(Effect.catch(() => Effect.succeed({ rows: [] as unknown[] })));
            const labels: Record<string, unknown> = {};
            for (const row of lookup.rows) {
              if (!isRecord(row)) continue;
              const key = row.key_value;
              if (key !== null && key !== undefined) labels[String(key)] = row.label_value;
            }
            return {
              sourceColumn: foreignKey.column_name,
              label: displayColumn,
              referencedTable: foreignKey.referenced_table_name,
              resolvedCount: keys.filter((key) => Object.hasOwn(labels, key)).length,
              unresolvedCount: keys.filter((key) => !Object.hasOwn(labels, key)).length,
              labels,
            };
          }),
        ),
        { concurrency: 2 },
      );
    }).pipe(
      Effect.catch(() => Effect.succeed([] as Array<ReadableRelation | null>)),
      withRemoteConnectionLayersFromUrl(connectionUrl),
    ),
  );
  const relations = relationLabels.filter(
    (relation): relation is ReadableRelation => relation !== null,
  );
  const relationSources = new Set(relations.map((relation) => String(relation.sourceColumn)));
  const readableColumns = [
    ...readableSourceColumns.filter((column) => !relationSources.has(column)),
    ...relations.map((relation) => `${String(relation.sourceColumn)}__label`),
  ].slice(0, 8);
  const readableRows = sourceRows.slice(0, MAX_PREVIEW_ROWS).map((row) => {
    const readable: Record<string, unknown> = {};
    for (const column of readableSourceColumns) readable[column] = row[column];
    for (const relation of relations) {
      const sourceColumn = String(relation.sourceColumn);
      const labels = isRecord(relation.labels) ? relation.labels : {};
      const key = row[sourceColumn];
      if (readableColumns.includes(`${sourceColumn}__label`)) {
        readable[`${sourceColumn}__label`] =
          key === null || key === undefined ? null : (labels[String(key)] ?? null);
      }
    }
    if (Object.keys(readable).length === 0) {
      for (const column of sourceColumns.slice(0, 4)) readable[column] = row[column];
    }
    return readable;
  });

  return toJsonSafeValue({
    ...(base as Record<string, unknown>),
    readableColumns,
    readableRows,
    readableRelations: relations.map((relation) => ({
      sourceColumn: relation.sourceColumn,
      label: relation.label,
      referencedTable: relation.referencedTable,
      resolvedCount: relation.resolvedCount,
      unresolvedCount: relation.unresolvedCount,
    })),
  });
};

/** table_details: columns + FK + indexes via the existing introspection fns. */
const tableDetailsToolExecute = async ({
  table,
  schema,
  connectionUrl,
}: {
  table: string;
  schema?: string;
  connectionUrl: string;
}) => {
  const program = Effect.gen(function* () {
    const resolvedSchema = schema || "public";
    const columns = yield* getTableColumns({ schema: resolvedSchema, table });
    const foreignKeys = yield* getTableForeignKeys({ schema: resolvedSchema, table }).pipe(
      Effect.catch(() => Effect.succeed([])),
    );
    const indexes = yield* getTableIndexes({ schema: resolvedSchema, table }).pipe(
      Effect.catch(() => Effect.succeed([])),
    );
    return { ok: true as const, columns, foreignKeys, indexes };
  }).pipe(withRemoteConnectionLayersFromUrl(connectionUrl));

  return AppRuntime.runPromise(program as never);
};

/** explain_sql: dialect-aware plan; graceful skip where unsupported. */
const explainSqlToolExecute = async ({
  sql,
  connectionUrl,
  dialect,
}: {
  sql: string;
  connectionUrl: string;
  dialect: string;
}) => {
  const prefix = explainPrefix(dialect);
  if (prefix === null) {
    return {
      ok: false as const,
      error: `EXPLAIN is not supported for ${dialect} in dadabase; propose without it.`,
    };
  }
  if (!isSelectQuery(sql)) {
    return { ok: false as const, error: "Only SELECT/WITH statements can be explained." };
  }
  return runSqlToolExecute({ sql: `${prefix}${sql}`, connectionUrl, enforceAccess: false });
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return new Response("Invalid JSON body.", { status: 400 });
        }
        const parsed = bodySchema.safeParse(rawBody);
        if (!parsed.success) {
          return new Response(`Invalid chat request: ${parsed.error.issues[0]?.message}`, {
            status: 400,
          });
        }
        const body = parsed.data;

        // BYOK: the key arrives per request and is never persisted.
        const openai = createOpenAI({
          apiKey: body.config.apiKey,
          ...(body.config.baseUrl ? { baseURL: body.config.baseUrl } : {}),
        });

        let connection;
        try {
          connection = await AppRuntime.runPromise(resolveConnection(body.connectionName));
        } catch {
          return new Response(`Connection not found: ${body.connectionName}`, { status: 404 });
        }

        let uiMessages;
        try {
          uiMessages = await validateUIMessages({ messages: body.messages as never });
        } catch (error) {
          return new Response(
            `Invalid chat messages: ${error instanceof Error ? error.message : String(error)}`,
            { status: 400 },
          );
        }

        // Resolve or create the persisted thread up front so the response can
        // carry its id back to the client runtime.
        const threadProgram = Effect.gen(function* () {
          const repo = yield* ChatThreadRepository;
          if (body.threadId) {
            const existing = yield* repo.findThread(body.threadId);
            if (existing) return existing.id;
          }
          const id = crypto.randomUUID();
          const title =
            uiMessages
              .find((m) => m.role === "user")
              ?.parts.find((p) => p.type === "text")
              ?.text.slice(0, 60) ?? "New chat";
          const now = Date.now();
          yield* repo.createThread({
            id,
            connection_id: connection.id,
            title,
            status: "regular",
            pinned: false,
            created_at: now,
            updated_at: now,
          });
          return id;
        });
        let threadId: string;
        try {
          threadId = await AppRuntime.runPromise(threadProgram as never);
        } catch (error) {
          return new Response(
            `Chat thread persistence failed: ${error instanceof Error ? error.message : String(error)}`,
            { status: 500 },
          );
        }

        const dataAccess = normalizeChatDataAccess(body.dataAccess);
        const accessMode = body.accessMode ?? "read-only";
        const enabledTools = applyChatDataAccessToTools(
          normalizeEnabledChatTools(body.enabledTools),
          dataAccess,
        );
        const contextAttachments = sanitizeChatContextAttachments(
          body.contextAttachments as ChatContextAttachment[] | undefined,
          dataAccess,
        );

        // Auto schema mode: one lightweight non-streaming call picks the tables
        // the question needs; the main completion sees only that subset.
        // Any failure (provider error, garbage reply, empty pick) falls back to
        // the full schema — auto must never make chat fail outright.
        let effectiveSchema = body.schemaContext;
        let resolvedAutoTables: string[] | null = null;
        if (
          body.schemaMode === "auto" &&
          effectiveSchema !== undefined &&
          effectiveSchema.tables.length > 0
        ) {
          try {
            const selection = await generateText({
              model: openai.chat(body.config.model),
              prompt: buildAutoSelectPrompt(effectiveSchema.tables),
            });
            const filtered = applyAutoSelection({ reply: selection.text, schema: effectiveSchema });
            if (filtered.tables.length < effectiveSchema.tables.length) {
              effectiveSchema = filtered;
              resolvedAutoTables = filtered.tables.map((table) => table.table);
            }
          } catch (error) {
            console.warn("[chat] auto schema selection failed; using full schema", error);
          }
        }

        // Audit T1/T2: one receipt of what this turn will actually send.
        const sentContext = {
          mode: body.schemaMode ?? "all",
          tables: effectiveSchema?.tables.map((table) => table.table) ?? [],
          tools: enabledTools,
          dataClasses: [
            ...new Set([
              ...dataClassesForChatTurn({
                hasSchema: effectiveSchema !== undefined && dataAccess.schema,
                enabledTools,
              }),
              ...dataClassesForChatContext(contextAttachments),
            ]),
          ],
          attachments: summarizeChatContextAttachments(contextAttachments),
        };

        const result = streamText({
          model: openai.chat(body.config.model),
          system: buildChatSystemPrompt({
            schema: effectiveSchema,
            enabledTools,
            contextAttachments,
            accessMode,
          }),
          messages: await convertToModelMessages(uiMessages),
          // Audit S5: Stop must reach the upstream provider, not just detach
          // the client — request.signal fires on client disconnect.
          abortSignal: request.signal,
          tools: {
            ...(enabledTools.includes("propose_sql")
              ? {
                  propose_sql: tool({
                    description:
                      "Create a SQL statement that answers the user's question. For a reasonably answerable data question, call this immediately instead of asking for clarification first. Always use this tool instead of writing SQL in plain text.",
                    inputSchema: z.object({
                      sql: z.string().min(1),
                      explanation: z.string().min(1),
                    }),
                    execute: async ({ sql }) => ({ sql }),
                  }),
                }
              : {}),
            ...(enabledTools.includes("run_sql")
              ? {
                  run_sql: tool({
                    description:
                      "Execute SQL to answer a reasonably answerable data question. SELECT/WITH runs directly; writes require explicit user approval.",
                    needsApproval: ({ sql }) => !isSelectQuery(sql),
                    inputSchema: z.object({
                      sql: z.string().min(1),
                    }),
                    execute: async ({ sql }) =>
                      runSqlToolExecute({
                        sql,
                        connectionUrl: connection.url,
                        accessMode,
                        schemaContext: effectiveSchema,
                      }),
                  }),
                }
              : {}),
            ...(enabledTools.includes("open_workspace_view")
              ? {
                  open_workspace_view: tool({
                    description:
                      "Offer opening a workspace browse tab pre-filtered on a table. The user must click the card to open it — never assume they did.",
                    inputSchema: OpenWorkspaceViewInputSchema,
                    execute: async (input) => ({ ok: true as const, view: input }),
                  }),
                }
              : {}),
            ...(enabledTools.includes("preview_rows")
              ? {
                  preview_rows: tool({
                    description:
                      "Peek at up to 25 sample rows of a table to learn its shape before drafting SQL.",
                    inputSchema: PreviewRowsInputSchema,
                    execute: async ({ table, schema, limit }) =>
                      previewRowsToolExecute({
                        table,
                        schema,
                        limit,
                        connectionUrl: connection.url,
                        dialect: connection.dialect,
                      }),
                  }),
                }
              : {}),
            ...(enabledTools.includes("table_details")
              ? {
                  table_details: tool({
                    description: "Inspect a table's columns/types plus FK and index metadata.",
                    inputSchema: TableDetailsInputSchema,
                    execute: async ({ table, schema }) =>
                      tableDetailsToolExecute({
                        table,
                        schema,
                        connectionUrl: connection.url,
                      }),
                  }),
                }
              : {}),
            ...(enabledTools.includes("explain_sql")
              ? {
                  explain_sql: tool({
                    description:
                      "Fetch the query execution plan for a SELECT statement before proposing it.",
                    inputSchema: ExplainSqlInputSchema,
                    execute: async ({ sql }) =>
                      explainSqlToolExecute({
                        sql,
                        connectionUrl: connection.url,
                        dialect: connection.dialect,
                      }),
                  }),
                }
              : {}),
          },
          stopWhen: stepCountIs(8),
        });

        // Persist the full turn once the stream finishes: incoming history plus
        // the final accumulated assistant message, mapped back to protocol parts.
        // Audit M4/T3: attach model + token usage to the UI stream's finish
        // metadata so the client can render per-message meta.
        const uiStream = result
          .toUIMessageStream({
            messageMetadata: ({ part }) => {
              if (part.type !== "finish") return undefined;
              const totalUsage = part.totalUsage;
              return {
                model: body.config.model,
                usage: {
                  promptTokens: totalUsage.inputTokens ?? null,
                  completionTokens: totalUsage.outputTokens ?? null,
                  totalTokens: totalUsage.totalTokens ?? null,
                },
                // Audit T1/T2: the receipt of what this turn actually sent.
                context: sentContext,
              };
            },
          })
          .tee();
        const [forClient, forPersistence] = uiStream;

        const persistTurn = (async () => {
          const reader = readUIMessageStream({ stream: forPersistence }).getReader();
          let last: Awaited<ReturnType<typeof reader.read>>["value"];
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            last = chunk.value;
          }
          const finalMessage = last;
          if (!finalMessage) return;

          const createId = (): string => crypto.randomUUID();
          // Audit M4/T3: preserve prior-turn model/usage that ai-sdk's
          // UIMessage schema strips — read them from the raw client records.
          const rawMetaById = new Map<
            string,
            { model?: unknown; usage?: unknown; context?: unknown }
          >();
          for (const record of body.messages) {
            if (isRecord(record) && typeof record.id === "string") {
              rawMetaById.set(record.id, {
                model: record.model,
                usage: record.usage,
                context: record.context,
              });
            }
          }
          const historyMessages = await Promise.all(
            uiMessages.map(async (message) => ({
              id: message.id || createId(),
              role: message.role,
              // The database stores protocol parts, not the raw AI SDK UI
              // parts. Keeping this boundary canonical is what makes history
              // reloadable after the SDK changes its stream representation.
              // The repository owns JSON serialization. Pass protocol parts
              // as structured data here so hydration does not receive a
              // double-encoded JSON string.
              parts: ChatUiMessages.toPersistedProtocolParts({
                parts: message.parts,
                createId,
              }),
              ...(rawMetaById.has(message.id)
                ? (rawMetaById.get(message.id) as {
                    model?: string;
                    usage?: unknown;
                    context?: unknown;
                  })
                : { model: undefined }),
            })),
          );
          const finalMetaRaw: unknown = finalMessage.metadata;
          const finalMetadata = isRecord(finalMetaRaw) ? finalMetaRaw : undefined;
          const assistantUsage =
            finalMetadata !== undefined && finalMetadata.usage !== undefined
              ? finalMetadata.usage
              : undefined;
          const assistantMessage = {
            id: finalMessage.id || createId(),
            role: finalMessage.role,
            // The repository serializes structured protocol parts exactly
            // once; double encoding makes restored messages look empty.
            parts: ChatUiMessages.toPersistedProtocolParts({
              parts: finalMessage.parts,
              createId,
            }),
            model: body.config.model,
            ...(assistantUsage !== undefined ? { usage: assistantUsage } : {}),
            // Audit T1/T2: persist what was sent so hydration can show it.
            context: sentContext,
          };
          const rows: Array<Omit<UpsertChatMessageInput, "threadId">> = [
            ...historyMessages.filter(
              (m) => m.role !== "assistant" || m.id !== assistantMessage.id,
            ),
            // Audit S5: a user-initiated stop aborts generation mid-turn; the
            // partial assistant message would read as a complete answer once
            // hydration exists. Keep the history, drop the truncated reply.
            ...(request.signal.aborted ? [] : [assistantMessage]),
          ];
          const program = Effect.gen(function* () {
            const repo = yield* ChatThreadRepository;
            yield* repo.replaceMessages({
              threadId,
              messages: rows.map((row) => ({ ...row, threadId })),
            });
          });
          await AppRuntime.runPromise(program as never);
        })();
        // Detached: persistence failures must not break the client stream.
        void persistTurn.catch((error) => {
          console.error("[chat] failed to persist turn", error);
        });

        return createUIMessageStreamResponse({
          headers: {
            "x-conversation-id": threadId,
            ...(resolvedAutoTables === null
              ? {}
              : { [AUTO_SCHEMA_HEADER]: JSON.stringify(resolvedAutoTables) }),
          },
          stream: forClient,
        });
      },
    },
  },
});
