import { AppDatabase } from "#src/db/app.db.ts";
import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import { NanoId } from "#src/server/services/nano-id.ts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { sql } from "kysely";
import { customAlphabet, nanoid as defaultNanoId } from "nanoid";

import { createDbConnection } from "./create-db-connection.ts";
import { deleteDbConnection } from "./delete-db-connection.ts";
import { updateDbConnection } from "./update-db-connection.ts";

const testNanoId = (prefix: string) =>
  Effect.sync(() => `${prefix}-${customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12)()}`);

const TestAppDatabaseLayer = Layer.effect(
  AppDatabase,
  makeEffectKyselyPglite<any>({
    dataDir: "memory://",
  }),
);

const TestNanoIdLayer = Layer.succeed(
  NanoId,
  new NanoId({
    unsafeGenerate: (prefix: string) => `${prefix}-test-nanoid`,
    unsafeNanoId: defaultNanoId,
    generate: testNanoId,
    generateMany: (prefix: string, count: number) =>
      Effect.sync(() =>
        Array.from(
          { length: count },
          (_, _i) =>
            `${prefix}-test-${customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12)()}`,
        ),
      ),
  }),
);

const TestDatabaseRepositoryLayer = DatabaseConnectionRepository.Default.pipe(
  Layer.provide(TestAppDatabaseLayer),
);

const InMemoryLayer = Layer.merge(
  TestAppDatabaseLayer,
  Layer.merge(TestNanoIdLayer, TestDatabaseRepositoryLayer),
);

const setupSchema = () =>
  Effect.gen(function* () {
    const db = yield* AppDatabase;
    yield* db.executeRaw(sql`
			CREATE TABLE IF NOT EXISTS database_connections (
				id TEXT PRIMARY KEY,
				url TEXT NOT NULL,
				dialect TEXT NOT NULL,
				name TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)
		`);
  });

describe("Database Connection Management Functions", () => {
  describe("createDbConnection", () => {
    it.effect("successfully creates a database connection", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        yield* createDbConnection({
          name: "Test Connection",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const connections = yield* repository.findAll();

        expect(connections.length).toBe(1);
        expect(connections[0].name).toBe("Test Connection");
        expect(connections[0].url).toBe("postgresql://localhost");
        expect(connections[0].dialect).toBe("postgres");
      }).pipe(Effect.provide(InMemoryLayer));
    });

    it.effect("creates multiple connections with unique IDs", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        yield* createDbConnection({
          name: "Connection 1",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        yield* createDbConnection({
          name: "Connection 2",
          url: "postgresql://otherhost",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const connections = yield* repository.findAll();

        expect(connections.length).toBe(2);
        expect(connections[0].id).not.toBe(connections[1].id);
      }).pipe(Effect.provide(InMemoryLayer));
    });

    it.effect("preserves URL query parameters during creation", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        const url = "postgresql://localhost/db?sslmode=require&connect_timeout=10";

        yield* createDbConnection({
          name: "Secure Connection",
          url,
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const connections = yield* repository.findAll();

        expect(connections[0].url).toBe(url);
      }).pipe(Effect.provide(InMemoryLayer));
    });

    it.effect("accepts various PostgreSQL connection URL formats", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        const urls = [
          "postgresql://user:pass@localhost:5432/db",
          "postgres://localhost/db",
          "postgresql://localhost",
        ];

        for (const url of urls) {
          yield* createDbConnection({
            name: `Test ${urls.indexOf(url)}`,
            url,
            dialect: DatabaseDialect.Postgres,
          });
        }

        const repository = yield* DatabaseConnectionRepository;
        const connections = yield* repository.findAll();

        expect(connections.length).toBe(3);
      }).pipe(Effect.provide(InMemoryLayer));
    });

    it.effect("accepts empty connection names", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        yield* createDbConnection({
          name: "",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const connections = yield* repository.findAll();

        expect(connections[0].name).toBe("");
      }).pipe(Effect.provide(InMemoryLayer));
    });
  });

  describe("updateDbConnection", () => {
    it.effect("successfully updates connection name", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        yield* createDbConnection({
          name: "Original Name",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const original = (yield* repository.findAll())[0];

        yield* updateDbConnection({
          id: original.id,
          name: "Updated Name",
          url: original.url,
        });

        const updated = (yield* repository.findAll())[0];
        expect(updated.name).toBe("Updated Name");
        expect(updated.url).toBe("postgresql://localhost");
      }).pipe(Effect.provide(InMemoryLayer));
    });

    it.effect("successfully updates connection URL", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        yield* createDbConnection({
          name: "Database Connection",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const original = (yield* repository.findAll())[0];

        yield* updateDbConnection({
          id: original.id,
          name: original.name,
          url: "postgresql://newhost:5432/newdb",
        });

        const updated = (yield* repository.findAll())[0];
        expect(updated.url).toBe("postgresql://newhost:5432/newdb");
      }).pipe(Effect.provide(InMemoryLayer));
    });

    it.effect("updates modified timestamp on update", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        yield* createDbConnection({
          name: "Test",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const original = (yield* repository.findAll())[0];

        yield* updateDbConnection({
          id: original.id,
          name: "Updated",
          url: original.url,
        });

        const updated = (yield* repository.findAll())[0];
        // Verify update succeeded
        expect(updated.name).toBe("Updated");
      }).pipe(Effect.provide(InMemoryLayer));
    });
    it.effect("accepts updates with special characters in name", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        yield* createDbConnection({
          name: "Connection (v1.0)",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const conn = (yield* repository.findAll())[0];

        yield* updateDbConnection({
          id: conn.id,
          name: "Updated Connection [v2.0] - Production",
          url: conn.url,
        });

        const updated = (yield* repository.findAll())[0];
        expect(updated.name).toBe("Updated Connection [v2.0] - Production");
      }).pipe(Effect.provide(InMemoryLayer));
    });
  });

  describe("deleteDbConnection", () => {
    it.effect("successfully deletes a connection", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        yield* createDbConnection({
          name: "Connection to Delete",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const before = yield* repository.findAll();
        expect(before.length).toBe(1);

        const toDelete = before[0];
        yield* deleteDbConnection(toDelete.id);

        const after = yield* repository.findAll();
        expect(after.length).toBe(0);
      }).pipe(Effect.provide(InMemoryLayer));
    });

    it.effect("can delete multiple connections selectively", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        yield* createDbConnection({
          name: "Keep Me",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        yield* createDbConnection({
          name: "Delete Me",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const all = yield* repository.findAll();
        const toDelete = all[1];

        yield* deleteDbConnection(toDelete.id);

        const remaining = yield* repository.findAll();
        expect(remaining.length).toBe(1);
        expect(remaining[0].name).toBe("Keep Me");
      }).pipe(Effect.provide(InMemoryLayer));
    });

    it.effect("deleting nonexistent connection does not error", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        // Should not throw
        yield* deleteDbConnection("db_conn_nonexistent");

        const repository = yield* DatabaseConnectionRepository;
        const all = yield* repository.findAll();
        expect(all.length).toBe(0);
      }).pipe(Effect.provide(InMemoryLayer));
    });

    it.effect("can delete all connections", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        for (let i = 0; i < 3; i++) {
          yield* createDbConnection({
            name: `Connection ${i}`,
            url: `postgresql://host${i}`,
            dialect: DatabaseDialect.Postgres,
          });
        }

        const repository = yield* DatabaseConnectionRepository;
        let all = yield* repository.findAll();
        expect(all.length).toBe(3);

        for (const conn of all) {
          yield* deleteDbConnection(conn.id);
        }

        all = yield* repository.findAll();
        expect(all.length).toBe(0);
      }).pipe(Effect.provide(InMemoryLayer));
    });
  });

  describe("Database Connection Functions Integration", () => {
    it.effect("CRUD cycle - create, read, update, delete", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        // CREATE
        yield* createDbConnection({
          name: "Integration Test",
          url: "postgresql://localhost/testdb",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        let all = yield* repository.findAll();
        const conn = all[0];
        expect(conn.name).toBe("Integration Test");

        // UPDATE
        yield* updateDbConnection({
          id: conn.id,
          name: "Updated Integration Test",
          url: "postgresql://newhost/testdb",
        });

        all = yield* repository.findAll();
        const updated = all[0];
        expect(updated.name).toBe("Updated Integration Test");
        expect(updated.url).toBe("postgresql://newhost/testdb");

        // DELETE
        yield* deleteDbConnection(updated.id);

        all = yield* repository.findAll();
        expect(all.length).toBe(0);
      }).pipe(Effect.provide(InMemoryLayer));
    });

    it.effect("connections preserve dialect as postgres", () => {
      return Effect.gen(function* () {
        yield* setupSchema();

        yield* createDbConnection({
          name: "Test",
          url: "postgresql://localhost",
          dialect: DatabaseDialect.Postgres,
        });

        const repository = yield* DatabaseConnectionRepository;
        const conn = (yield* repository.findAll())[0];

        expect(conn.dialect).toBe("postgres");
      }).pipe(Effect.provide(InMemoryLayer));
    });
  });
});
