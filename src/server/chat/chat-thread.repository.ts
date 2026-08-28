import type { Insertable, Selectable } from "kysely";

import { Context, Effect, Layer } from "effect";

import type { AppDatabaseSchema } from "#src/db/app.db.schema.ts";

import { AppDatabase } from "#src/db/app.db.ts";

export type ChatThreadRow = Selectable<AppDatabaseSchema["chat_threads"]>;
export type ChatMessageRow = Selectable<AppDatabaseSchema["chat_messages"]>;

// (UpsertChatMessageInput declared after the service below)

/**
 * Persistence for the AI chat assistant: threads are connection-scoped
 * conversations; messages store protocol parts as JSON.
 */
const makeChatThreadRepository = Effect.gen(function* () {
  const db = yield* AppDatabase;

  return {
    listThreads: Effect.fn(function* (input: { connectionId: string }) {
      return yield* db.execute(
        db
          .selectFrom("chat_threads")
          .selectAll()
          .where("connection_id", "=", input.connectionId)
          .orderBy("pinned", "desc")
          .orderBy("created_at", "desc"),
      );
    }),

    findThread: Effect.fn(function* (id: string) {
      const rows = yield* db.execute(
        db.selectFrom("chat_threads").selectAll().where("id", "=", id),
      );
      return rows.length > 0 ? rows[0] : null;
    }),

    createThread: Effect.fn(function* (insertable: Insertable<AppDatabaseSchema["chat_threads"]>) {
      return yield* db.execute(
        db.insertInto("chat_threads").values({
          id: insertable.id,
          connection_id: insertable.connection_id,
          title: insertable.title,
          status: insertable.status,
          pinned: insertable.pinned,
          created_at: insertable.created_at,
          updated_at: insertable.updated_at,
        }),
      );
    }),

    updateThread: Effect.fn(function* (input: {
      id: string;
      patch: { title?: string; status?: "regular" | "archived"; pinned?: boolean };
    }) {
      return yield* db.execute(
        db
          .updateTable("chat_threads")
          .set({
            ...(input.patch.title === undefined ? {} : { title: input.patch.title }),
            ...(input.patch.status === undefined ? {} : { status: input.patch.status }),
            ...(input.patch.pinned === undefined ? {} : { pinned: input.patch.pinned }),
            updated_at: Date.now(),
          })
          .where("id", "=", input.id),
      );
    }),

    deleteThread: Effect.fn(function* (id: string) {
      // chat_messages has an FK cascade, but sqlite only honors it with the
      // foreign_keys pragma — delete children explicitly to be safe.
      yield* db.execute(db.deleteFrom("chat_messages").where("thread_id", "=", id));
      return yield* db.execute(db.deleteFrom("chat_threads").where("id", "=", id));
    }),

    listMessages: Effect.fn(function* (threadId: string) {
      return yield* db.execute(
        db
          .selectFrom("chat_messages")
          .selectAll()
          .where("thread_id", "=", threadId)
          .orderBy("created_at", "asc")
          .orderBy("id", "asc"),
      );
    }),

    replaceMessages: Effect.fn(function* (input: {
      threadId: string;
      messages: ReadonlyArray<UpsertChatMessageInput>;
    }) {
      // Two streams can finish close together for the same conversation.
      // Keep replacement atomic so delete + insert cannot interleave and
      // violate the chat_messages primary key.
      const uniqueMessages = [
        ...new Map(input.messages.map((message) => [message.id, message])).values(),
      ];
      yield* db.transaction().execute((trx) =>
        Effect.gen(function* () {
          yield* trx.execute(
            trx.deleteFrom("chat_messages").where("thread_id", "=", input.threadId),
          );
          const existingIds =
            uniqueMessages.length === 0
              ? []
              : yield* trx.execute(
                  trx
                    .selectFrom("chat_messages")
                    .select(["id", "thread_id"])
                    .where(
                      "id",
                      "in",
                      uniqueMessages.map((message) => message.id),
                    ),
                );
          const occupiedByAnotherThread = new Set(
            existingIds.filter((row) => row.thread_id !== input.threadId).map((row) => row.id),
          );
          for (const message of uniqueMessages) {
            if (message.role === "user" || message.role === "assistant") {
              // Client message IDs are normally globally unique, but an old
              // client or two browser tabs can reuse one. Keep both turns by
              // making only the colliding persisted key thread-scoped.
              const persistedId = occupiedByAnotherThread.has(message.id)
                ? `${input.threadId}:${message.id}`
                : message.id;
              yield* trx.execute(
                trx.insertInto("chat_messages").values({
                  id: persistedId,
                  thread_id: message.threadId,
                  role: message.role,
                  parts: JSON.stringify(message.parts),
                  model: message.model ?? null,
                  usage:
                    message.usage === undefined || message.usage === null
                      ? null
                      : JSON.stringify(message.usage),
                  context:
                    message.context === undefined || message.context === null
                      ? null
                      : JSON.stringify(message.context),
                  created_at: Date.now(),
                }),
              );
            }
          }
          yield* trx.execute(
            trx
              .updateTable("chat_threads")
              .set({ updated_at: Date.now() })
              .where("id", "=", input.threadId),
          );
        }),
      );
    }),
  };
});

type ChatThreadRepositoryShape = Effect.Success<typeof makeChatThreadRepository>;

export class ChatThreadRepository extends Context.Service<
  ChatThreadRepository,
  ChatThreadRepositoryShape
>()("@dadabase/server/ChatThreadRepository") {
  static readonly Default = Layer.effect(ChatThreadRepository)(makeChatThreadRepository);
}

export type UpsertChatMessageInput = {
  id: string;
  threadId: string;
  role: string;
  parts: unknown;
  model?: string | undefined;
  usage?: unknown;
  context?: unknown;
};
