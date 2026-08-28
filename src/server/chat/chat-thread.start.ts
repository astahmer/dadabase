import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import type { ChatContextReceipt, MessageUsage } from "#src/lib/chat/protocol/messages.ts";
import type { ChatMessageRow, ChatThreadRow } from "#src/server/chat/chat-thread.repository.ts";

import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { toValidator } from "#src/db/effect-compat.ts";
import { ChatContextReceiptSchema, MessageUsageSchema } from "#src/lib/chat/protocol/messages.ts";
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
  /** Bounded plain-text index used by the full-chat fuzzy search. */
  searchText?: string;
}

/** Message row as consumed by the chat ConversationClient adapter. */
export interface ChatMessageSummary {
  id: string;
  role: string;
  parts: string; // JSON array of protocol MessagePart
  model: string | null;
  usage: MessageUsage | null; // token counts or null
  context: ChatContextReceipt | null; // Audit T1/T2: { mode, tables, tools } | null
  createdAt: string;
}

/**
 * Normalize the persisted protocol-part payload for clients. Older chat
 * writes accidentally JSON-encoded the parts twice; accept those rows while
 * keeping the current storage format as one JSON array.
 */
export const normalizePersistedMessageParts = (rawParts: unknown): string => {
  if (typeof rawParts !== "string") return JSON.stringify(rawParts ?? []);
  try {
    const parsed: unknown = JSON.parse(rawParts);
    if (typeof parsed === "string") {
      const nested: unknown = JSON.parse(parsed);
      if (Array.isArray(nested)) return JSON.stringify(nested);
    }
  } catch {
    // Preserve malformed data so the client can report/skip just this message.
  }
  return rawParts;
};

export const persistedMessageSearchText = (rawParts: unknown): string => {
  const normalized = normalizePersistedMessageParts(rawParts);
  try {
    const parsed: unknown = JSON.parse(normalized);
    const values: string[] = [];
    const visit = (value: unknown): void => {
      if (values.join(" ").length >= 4000) return;
      if (typeof value === "string") return;
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if ((key === "text" || key === "sql" || key === "title") && typeof child === "string") {
          values.push(child);
        } else {
          visit(child);
        }
      }
    };
    visit(parsed);
    return values.join(" ").slice(0, 4000);
  } catch {
    return "";
  }
};

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

const toSummary = (row: ChatThreadRow, searchText?: string): ChatThreadSummary => ({
  id: row.id,
  title: row.title,
  status: row.status === "archived" ? "archived" : "regular",
  pinned: Boolean(row.pinned),
  // Flat model: the thread IS the conversation in dadabase.
  conversationId: row.id,
  anchorMessageId: "",
  createdAt: new Date(row.created_at ?? Date.now()).toISOString(),
  updatedAt: new Date(row.updated_at ?? row.created_at ?? Date.now()).toISOString(),
  ...(searchText === undefined ? {} : { searchText }),
});

const toMessageSummary = (row: ChatMessageRow): ChatMessageSummary => {
  // Audit M4/T3: usage rides as JSON (kysely types json() as string|null).
  const rawUsage: unknown = row.usage;
  const parsedUsage: unknown =
    typeof rawUsage === "string"
      ? (() => {
          try {
            return JSON.parse(rawUsage) as unknown;
          } catch {
            return undefined;
          }
        })()
      : rawUsage;
  const parsed = MessageUsageSchema.safeParse(parsedUsage);
  // Audit T1/T2: context rides as JSON exactly like usage.
  const rawContext: unknown = row.context;
  const parsedContextRaw: unknown =
    typeof rawContext === "string"
      ? (() => {
          try {
            return JSON.parse(rawContext) as unknown;
          } catch {
            return undefined;
          }
        })()
      : rawContext;
  const parsedContext = ChatContextReceiptSchema.safeParse(parsedContextRaw);
  return {
    id: row.id,
    role: row.role,
    parts: normalizePersistedMessageParts(row.parts),
    model: row.model,
    usage: parsed.success ? parsed.data : null,
    context: parsedContext.success ? parsedContext.data : null,
    createdAt: new Date(row.created_at ?? Date.now()).toISOString(),
  };
};

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
          const searches = yield* Effect.all(
            rows.map((row) =>
              repo
                .listMessages(row.id)
                .pipe(
                  Effect.map((messages) =>
                    messages.map((message) => persistedMessageSearchText(message.parts)).join(" "),
                  ),
                ),
            ),
            // The app database is SQLite/libSQL. Serialize these small reads
            // so a thread-list refresh cannot contend with the turn writer
            // and surface SQLITE_BUSY to an otherwise successful chat send.
            { concurrency: 1 },
          );
          return rows.map((row, index) => toSummary(row, searches[index]));
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
