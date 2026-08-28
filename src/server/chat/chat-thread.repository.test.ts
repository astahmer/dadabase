import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { AppDatabase } from "#src/db/app.db.ts";
import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";

import { ChatThreadRepository } from "./chat-thread.repository.ts";

const TestAppDatabaseLayer = Layer.effect(
  AppDatabase,
  makeEffectKyselyPglite<any>({
    dataDir: "memory://chat-thread-repository-test",
    setup: async (db) => {
      await db.schema
        .createTable("database_connections")
        .addColumn("id", "text", (column) => column.primaryKey())
        .addColumn("url", "text", (column) => column.notNull())
        .addColumn("dialect", "text", (column) => column.notNull())
        .addColumn("name", "text", (column) => column.notNull())
        .addColumn("created_at", "bigint", (column) => column.notNull())
        .addColumn("updated_at", "bigint", (column) => column.notNull())
        .execute();
      await db.schema
        .createTable("chat_threads")
        .addColumn("id", "text", (column) => column.primaryKey())
        .addColumn("connection_id", "text", (column) => column.notNull())
        .addColumn("title", "text", (column) => column.notNull())
        .addColumn("status", "text", (column) => column.notNull())
        .addColumn("pinned", "boolean", (column) => column.notNull())
        .addColumn("created_at", "bigint", (column) => column.notNull())
        .addColumn("updated_at", "bigint", (column) => column.notNull())
        .execute();
      await db.schema
        .createTable("chat_messages")
        .addColumn("id", "text", (column) => column.primaryKey())
        .addColumn("thread_id", "text", (column) => column.notNull())
        .addColumn("role", "text", (column) => column.notNull())
        .addColumn("parts", "text", (column) => column.notNull())
        .addColumn("model", "text")
        .addColumn("usage", "text")
        .addColumn("context", "text")
        .addColumn("created_at", "bigint", (column) => column.notNull())
        .execute();
      await db
        .insertInto("database_connections")
        .values({
          id: "connection-1",
          url: "file:app.db",
          dialect: "sqlite",
          name: "Test connection",
          created_at: Date.now(),
          updated_at: Date.now(),
        })
        .execute();
    },
  }),
);

const TestLayer = ChatThreadRepository.Default.pipe(Layer.provide(TestAppDatabaseLayer));

describe("ChatThreadRepository", () => {
  it.effect("replaces messages without inserting duplicate IDs", () =>
    Effect.gen(function* () {
      const repository = yield* ChatThreadRepository;
      const now = Date.now();

      yield* repository.createThread({
        id: "thread-1",
        connection_id: "connection-1",
        title: "Test thread",
        status: "regular",
        pinned: false,
        created_at: now,
        updated_at: now,
      });

      yield* repository.replaceMessages({
        threadId: "thread-1",
        messages: [
          { id: "message-1", threadId: "thread-1", role: "user", parts: ["question"] },
          { id: "message-1", threadId: "thread-1", role: "assistant", parts: ["answer"] },
        ],
      });

      const firstReplacement = yield* repository.listMessages("thread-1");
      expect(firstReplacement).toHaveLength(1);
      expect(firstReplacement[0]?.role).toBe("assistant");
      expect(JSON.parse(firstReplacement[0]?.parts ?? "null")).toEqual(["answer"]);

      yield* repository.replaceMessages({
        threadId: "thread-1",
        messages: [{ id: "message-2", threadId: "thread-1", role: "user", parts: ["next"] }],
      });

      const secondReplacement = yield* repository.listMessages("thread-1");
      expect(secondReplacement.map((message) => message.id)).toEqual(["message-2"]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("keeps colliding client IDs isolated between threads", () =>
    Effect.gen(function* () {
      const repository = yield* ChatThreadRepository;
      const now = Date.now();
      for (const id of ["thread-a", "thread-b"]) {
        yield* repository.createThread({
          id,
          connection_id: "connection-1",
          title: id,
          status: "regular",
          pinned: false,
          created_at: now,
          updated_at: now,
        });
      }

      yield* repository.replaceMessages({
        threadId: "thread-a",
        messages: [{ id: "same-client-id", threadId: "thread-a", role: "user", parts: ["a"] }],
      });
      yield* repository.replaceMessages({
        threadId: "thread-b",
        messages: [{ id: "same-client-id", threadId: "thread-b", role: "user", parts: ["b"] }],
      });

      const first = yield* repository.listMessages("thread-a");
      const second = yield* repository.listMessages("thread-b");
      expect(first[0]?.id).toBe("same-client-id");
      expect(second[0]?.id).toBe("thread-b:same-client-id");
      expect(JSON.parse(second[0]?.parts ?? "null")).toEqual(["b"]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
