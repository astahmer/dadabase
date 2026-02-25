import { Effect } from "effect";
import { sql } from "kysely";
import { createRequire } from "node:module";

import * as AppDbSchema from "./app.db.schema.ts";
import { AppDatabase } from "./app.db.ts";

// https://github.com/drizzle-team/drizzle-orm/discussions/1901#discussioncomment-11689415
export const MigrateAppDatabase = Effect.gen(function* () {
  const db = yield* AppDatabase;
  const migrationList = yield* Effect.tryPromise(async () => {
    global.require = createRequire(import.meta.url);
    const { generateSQLiteDrizzleJson, generateSQLiteMigration } = await import("drizzle-kit/api");

    const [previous, current] = await Promise.all(
      [{}, AppDbSchema].map((schemaObject) => generateSQLiteDrizzleJson(schemaObject)),
    );
    console.log(previous, current);

    return generateSQLiteMigration(previous, current);
  });
  console.log(AppDbSchema, migrationList);

  yield* Effect.forEach(migrationList, (statement) =>
    db.executeRaw(sql.raw(statement.replace("INDEX CONCURRENTLY", "INDEX"))),
  );
});
