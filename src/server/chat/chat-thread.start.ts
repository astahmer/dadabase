import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { toValidator } from "#src/db/effect-compat.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import type { ChatMessageRow, ChatThreadRow } from "#src/server/chat/chat-thread.repository.ts";
import { ChatThreadRepository } from "#src/server/chat/chat-thread.repository.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

/** Thread payload as consumed by the chat ConversationClient adapter. */
export interface ChatThreadSummary {
  id: string;
  title: string | null;
  status: "regular" | "archived";
  pinned: boolean;
  conversationId: string;
  anchorMessageId: string;
  createdAt: string;
  updatedAt: string;
}

/** Message row as consumed by the chat ConversationClient adapter. */
export interface ChatMessageSummary {
  id: string;
  role: string;
  parts: string; // JSON array of protocol MessagePart
  model: string | null;
  createdAt: string;
}

const ThreadPatchSchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Literals(["regular", "archived"])),
  pinned: Schema.optional(Schema.Boolean),
});

const ConnectionNameSchema = Schema.String;
const ThreadRefSchema = Schema.Struct({
  connectionName: Schema.String,
  threadId: Schema.String,
});

const toSummary = (row: ChatThreadRow): ChatThreadSummary => ({
  id: row.id,
  title: row.title,
  status: row.status === "archived" ? "archived" : "regular",
  pinned: Boolean(row.pinned),
  // Flat model: the thread IS the conversation in dadabase.
  conversationId: row.id,
  anchorMessageId: "",
  createdAt: new Date(row.created_at ?? Date.now()).toISOString(),
  updatedAt: new Date(row.updated_at ?? row.created_at ?? Date.now()).toISOString(),
});

const toMessageSummary = (row: ChatMessageRow): ChatMessageSummary => ({
  id: row.id,
  role: row.role,
  parts: typeof row.parts === "string" ? row.parts : JSON.stringify(row.parts ?? []),
  model: row.model,
  createdAt: new Date(row.created_at ?? Date.now()).toISOString(),
});

/** Resolve a saved connection by name, then run the inner effect with its id. */
type AnyEffect<A> = Effect.Effect<A, Error, DatabaseConnectionRepository | ChatThreadRepository>;

const withConnection = <A>(connectionName: string, inner: (connectionId: string) => AnyEffect<A>) =>
  Effect.gen(function* () {
    const connections = yield* DatabaseConnectionRepository;
    const connection = yield* connections.findByName(connectionName);
    if (!connection) {
      return yield* Effect.fail(new Error(`Connection not found: ${connectionName}`));
    }
    return yield* inner(connection.id);
  }) as Effect.Effect<A, Error, never>;

const runOrThrow = async <A>(program: Effect.Effect<A, Error, never>): Promise<A> => {
  try {
    return await AppRuntime.runPromise(program as never);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
};

export const listChatThreadsServerFn = createServerFn({ method: "POST" })
  .validator(ConnectionNameSchema.pipe(toValidator))
  .handler(async ({ data: connectionName }) =>
    runOrThrow(
      withConnection(connectionName, (connectionId) =>
        Effect.gen(function* () {
          const repo = yield* ChatThreadRepository;
          const rows = yield* repo.listThreads({ connectionId });
          return rows.map(toSummary);
        }),
      ),
    ),
  );

export const getChatThreadMessagesServerFn = createServerFn({ method: "POST" })
  .validator(ThreadRefSchema.pipe(toValidator))
  .handler(async ({ data }) =>
    runOrThrow(
      withConnection(data.connectionName, () =>
        Effect.gen(function* () {
          const repo = yield* ChatThreadRepository;
          const thread = yield* repo.findThread(data.threadId);
          if (!thread) throw new Error(`Chat thread not found: ${data.threadId}`);
          const messages = yield* repo.listMessages(data.threadId);
          return { thread: toSummary(thread), messages: messages.map(toMessageSummary) };
        }),
      ),
    ),
  );

export const updateChatThreadServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      connectionName: Schema.String,
      threadId: Schema.String,
      patch: ThreadPatchSchema,
    }).pipe(toValidator),
  )
  .handler(async ({ data }) =>
    runOrThrow(
      withConnection(data.connectionName, () =>
        Effect.gen(function* () {
          const repo = yield* ChatThreadRepository;
          yield* repo.updateThread({
            id: data.threadId,
            patch: data.patch as {
              title?: string;
              status?: "regular" | "archived";
              pinned?: boolean;
            },
          });
          const thread = yield* repo.findThread(data.threadId);
          if (!thread) throw new Error(`Chat thread not found: ${data.threadId}`);
          return toSummary(thread);
        }),
      ),
    ),
  );

export const deleteChatThreadServerFn = createServerFn({ method: "POST" })
  .validator(ThreadRefSchema.pipe(toValidator))
  .handler(async ({ data }) =>
    runOrThrow(
      withConnection(data.connectionName, () =>
        Effect.gen(function* () {
          const repo = yield* ChatThreadRepository;
          yield* repo.deleteThread(data.threadId);
          return { deleted: true as const };
        }),
      ),
    ),
  );
