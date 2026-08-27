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

import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
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
import { buildChatSystemPrompt } from "#src/lib/ai/nl-to-sql-prompt.ts";
import { applyAutoSelection, buildAutoSelectPrompt } from "#src/lib/ai/schema-auto-select.ts";
import { isReadOnlyConnection } from "#src/lib/connection-security.ts";
import {
  ChatThreadRepository,
  type UpsertChatMessageInput,
} from "#src/server/chat/chat-thread.repository.ts";
import { withRemoteConnectionLayersFromUrl } from "#src/server/create-remote-server-fn.ts";
import { isSelectQuery } from "#src/server/introspection/detect-destructive-sql.ts";
import {
  executeCustomSql,
  getTableColumns,
  getTableForeignKeys,
  getTableIndexes,
} from "#src/server/introspection/introspection.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

const MAX_RESULT_ROWS = 50;
const MAX_PREVIEW_ROWS = 25;

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

const bodySchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
  config: ChatRequestConfigSchema,
  connectionName: z.string().min(1),
  schemaContext: z.custom<AiSchemaContext>((value) => value !== null).optional(),
  threadId: z.string().optional(),
  /** Enabled tools; absent → all. Unknown ids are dropped server-side. */
  enabledTools: z.array(z.string()).optional(),
  /** Row and result access are separate from schema-sharing consent. */
  dataAccess: z
    .object({
      schema: z.boolean(),
      sampleRows: z.boolean(),
      queryResults: z.boolean(),
    })
    .optional(),
  /**
   * "auto": one lightweight generateText call first picks the needed tables
   * from the full schema; the main completion then sees only that subset.
   * Absent → use schemaContext as sent ("all"/client-filtered "selected").
   */
  schemaMode: z.enum(["auto"]).optional(),
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
}: {
  sql: string;
  connectionUrl: string;
}) => {
  const program = Effect.gen(function* () {
    if (isReadOnlyConnection(connectionUrl) && !isSelectQuery(sql)) {
      return { ok: false as const, error: "This connection is read-only. Only SELECT queries." };
    }
    const result = yield* executeCustomSql({ sql });
    const rows = result.rows.slice(0, MAX_RESULT_ROWS).map((row) => {
      const record: Record<string, unknown> = {};
      for (const col of result.columns) {
        record[col] = (row as Record<string, unknown>)[col];
      }
      return record;
    });
    return {
      ok: true as const,
      columns: result.columns,
      rowCount: result.rowCount,
      rowsAffected: result.rowsAffected ?? null,
      truncated: result.rows.length > MAX_RESULT_ROWS,
      rows,
    };
  }).pipe(withRemoteConnectionLayersFromUrl(connectionUrl));

  return AppRuntime.runPromise(program as never);
};

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
  return runSqlToolExecute({ sql, connectionUrl });
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
  return runSqlToolExecute({ sql: `${prefix}${sql}`, connectionUrl });
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
        const enabledTools = applyChatDataAccessToTools(
          normalizeEnabledChatTools(body.enabledTools),
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
          dataClasses: dataClassesForChatTurn({
            hasSchema: effectiveSchema !== undefined && dataAccess.schema,
            enabledTools,
          }),
        };

        const result = streamText({
          model: openai.chat(body.config.model),
          system: buildChatSystemPrompt({ schema: effectiveSchema, enabledTools }),
          messages: await convertToModelMessages(uiMessages),
          // Audit S5: Stop must reach the upstream provider, not just detach
          // the client — request.signal fires on client disconnect.
          abortSignal: request.signal,
          tools: {
            ...(enabledTools.includes("propose_sql")
              ? {
                  propose_sql: tool({
                    description:
                      "Create a SQL statement that answers the user's question. Always use this tool instead of writing SQL in plain text.",
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
                      "Execute a SQL statement against the connected database. Requires explicit user approval before it runs.",
                    needsApproval: true,
                    inputSchema: z.object({
                      sql: z.string().min(1),
                    }),
                    execute: async ({ sql }) =>
                      runSqlToolExecute({ sql, connectionUrl: connection.url }),
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
              parts: JSON.stringify(message.parts),
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
            parts: JSON.stringify(finalMessage.parts),
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
