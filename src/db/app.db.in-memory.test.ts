import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { AppDbInMemoryLayer } from "./app.db.in-memory.ts";
import { MigrateAppDatabase } from "./app.db.migrate.ts";
import { AppDatabase } from "./app.db.ts";
import { DatabaseConnectionRepository } from "./database-connection.repository.ts";
import { sql } from "kysely";

describe("DatabaseConnectionRepository", () => {
	const testLayer = DatabaseConnectionRepository.Default.pipe(
		Layer.provideMerge(AppDbInMemoryLayer),
	);

	it.effect("can insert", () => {
		const test = Effect.gen(function* () {
			// yield* MigrateAppDatabase;
			const db = yield* AppDatabase;

			// const example = db.schema
			// 	.createTable("person")
			// 	.addColumn("id", "serial", (col) => col.primaryKey())
			// 	.addColumn("first_name", "varchar", (col) => col.notNull())
			// 	.addColumn("last_name", "varchar")
			// 	.addColumn("gender", "varchar(50)", (col) => col.notNull())
			// 	.addColumn("created_at", "timestamp", (col) =>
			// 		col.defaultTo(sql`now()`).notNull(),
			// 	)
			// 	.execute();

			const repo = yield* DatabaseConnectionRepository;
			yield* repo.insert({
				id: "db_conn_1",
				dialect: "postgres",
				name: "database",
				url: "postgres://dbUser:secretPasswordDontWorry@localhost:5432/backend",
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
			});

			const found = yield* db.execute(
				db.selectFrom("database_connections").selectAll(),
			);

			expect(found).toMatchInlineSnapshot();
		}).pipe(Effect.provide(testLayer));

		return test;
	});
});
