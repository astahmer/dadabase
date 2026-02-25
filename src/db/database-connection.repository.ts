import type { Insertable } from "kysely";

import { Effect } from "effect";

import type { AppDatabaseSchema } from "./app.db.schema.ts";

import { AppDatabase } from "./app.db.ts";

export class DatabaseConnectionRepository extends Effect.Service<DatabaseConnectionRepository>()(
  "@dadabase/db/DatabaseConnectionRepository",
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const db = yield* AppDatabase;
      return {
        findAll: () => {
          return db.execute(
            db.selectFrom("database_connections").selectAll().where("id", "is not", null),
          );
        },
        findByName: Effect.fn(function* (name: string) {
          const results = yield* db.execute(
            db.selectFrom("database_connections").selectAll().where("name", "=", name),
          );

          return results.length > 0 ? results[0] : null;
        }),
        findByUrl: Effect.fn(function* (connectionUrl: string) {
          // Parse URL to extract base URL (without database part)
          // Connection URLs can be: postgresql://user:pass@host:port or postgresql://user:pass@host:port/database
          const urlWithoutDb = connectionUrl.split("/").slice(0, -1).join("/");
          const urlWithDb = connectionUrl;

          // Find connections matching either the exact URL or the base URL
          const results = yield* db.execute(
            db
              .selectFrom("database_connections")
              .selectAll()
              .where((qb) => qb.or([qb("url", "=", urlWithDb), qb("url", "=", urlWithoutDb)])),
          );

          return results.length > 0 ? results[0] : null;
        }),
        insert: Effect.fn(function* (
          insertable: Insertable<AppDatabaseSchema["database_connections"]>,
        ) {
          return yield* db.execute(
            db.insertInto("database_connections").values({
              id: insertable.id,
              dialect: insertable.dialect,
              name: insertable.name,
              url: insertable.url,
              created_at: insertable.created_at,
              updated_at: insertable.updated_at,
            }),
          );
        }),
        update: Effect.fn(function* (input: { id: string; name: string; url: string }) {
          return yield* db.execute(
            db
              .updateTable("database_connections")
              .set({
                name: input.name,
                url: input.url,
                updated_at: new Date().getTime(),
              })
              .where("id", "=", input.id),
          );
        }),
        delete: Effect.fn(function* (input: { id: string }) {
          return yield* db.execute(
            db.deleteFrom("database_connections").where("id", "=", input.id),
          );
        }),
      };
    }),
  },
) {}
