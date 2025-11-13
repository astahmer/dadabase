import { createRequire } from "node:module";
import * as AppDbSchema from "./app.db.schema.ts";
import { Effect } from "effect";
import { sql } from "kysely";
import { AppDatabase } from "./app.db.ts";

// https://github.com/drizzle-team/drizzle-orm/discussions/1901#discussioncomment-11689415
export const MigrateDatabase = Effect.gen(function* () {
	const db = yield* AppDatabase;
	const migrationList = yield* Effect.tryPromise(async () => {
		global.require = createRequire(import.meta.url);
		const { generateDrizzleJson, generateMigration } = await import(
			"drizzle-kit/api"
		);

		const [previous, current] = await Promise.all(
			[{}, AppDbSchema].map((schemaObject) =>
				generateDrizzleJson(schemaObject),
			),
		);
		console.log(previous, current);

		return generateMigration(previous!, current!);
	});
	console.log(AppDbSchema, migrationList);

	yield* Effect.forEach(migrationList, (statement) =>
		db.executeRaw(sql.raw(statement.replace("INDEX CONCURRENTLY", "INDEX"))),
	);
});
