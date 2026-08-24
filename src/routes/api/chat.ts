import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  readUIMessageStream,
  stepCountIs,
  streamText,
  tool,
  validateUIMessages,
} from "ai";
import { Effect } from "effect";
import { z } from "zod";

import { isReadOnlyConnection } from "#src/lib/connection-security.ts";
import type { AiSchemaContext } from "#src/lib/ai/ai-types.ts";
import { buildChatSystemPrompt } from "#src/lib/ai/nl-to-sql-prompt.ts";
import { withRemoteConnectionLayersFromUrl } from "#src/server/create-remote-server-fn.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import {
  ChatThreadRepository,
  type UpsertChatMessageInput,
} from "#src/server/chat/chat-thread.repository.ts";
import { executeCustomSql } from "#src/server/introspection/introspection.ts";
import { isSelectQuery } from "#src/server/introspection/detect-destructive-sql.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

const MAX_RESULT_ROWS = 50;

const bodySchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
  config: z.object({
    apiKey: z.string().min(1),
    model: z.string().min(1),
    baseUrl: z.string().optional(),
  }),
  connectionName: z.string().min(1),
  schemaContext: z.custom<AiSchemaContext>((value) => value !== null).optional(),
  threadId: z.string().optional(),
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
        const openai = createOpenAI({ apiKey: body.config.apiKey, ...(body.config.baseUrl ? { baseURL: body.config.baseUrl } : {}) });

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
            uiMessages.find((m) => m.role === "user")?.parts
              .find((p) => p.type === "text")
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

        const result = streamText({
          model: openai.chat(body.config.model),
          system: buildChatSystemPrompt({ schema: body.schemaContext }),
          messages: await convertToModelMessages(uiMessages),
          tools: {
            propose_sql: tool({
              description:
                "Create a SQL statement that answers the user's question. Always use this tool instead of writing SQL in plain text.",
              inputSchema: z.object({
                sql: z.string().min(1),
                explanation: z.string().min(1),
              }),
              execute: async ({ sql }) => ({ sql }),
            }),
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
          },
          stopWhen: stepCountIs(8),
        });

        // Persist the full turn once the stream finishes: incoming history plus
        // the final accumulated assistant message, mapped back to protocol parts.
        const uiStream = result.toUIMessageStream();
        const [forClient, forPersistence] = uiStream.tee();

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
          const historyMessages = await Promise.all(
            uiMessages.map(async (message) => ({
              id: message.id || createId(),
              role: message.role,
              parts: JSON.stringify(message.parts),
              model: undefined,
            })),
          );
          const assistantMessage = {
            id: finalMessage.id || createId(),
            role: finalMessage.role,
            parts: JSON.stringify(finalMessage.parts),
            model: body.config.model,
          };
          const rows: Array<Omit<UpsertChatMessageInput, "threadId">> = [
            ...historyMessages.filter((m) => m.role !== "assistant" || m.id !== assistantMessage.id),
            assistantMessage,
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
          headers: { "x-conversation-id": threadId },
          stream: forClient,
        });
      },
    },
  },
});
