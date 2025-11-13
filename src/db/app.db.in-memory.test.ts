import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { AppDbInMemoryLayer } from "./app.db.in-memory.ts";
import { MigrateDatabase } from "./app.db.migrate.ts";
import { AppDatabase } from "./app.db.ts";
import { DatabaseConnectionRepository } from "./database-connection.repository.ts";

describe("DatabaseConnectionRepository", () => {
	const testLayer = DatabaseConnectionRepository.Default.pipe(
		Layer.provideMerge(AppDbInMemoryLayer),
	);

	it.effect("can insert", () => {
		const test = Effect.gen(function* () {
			yield* MigrateDatabase;

			const repo = yield* DatabaseConnectionRepository;
			yield* repo.insert({
				id: "db_conn_1",
				dialect: "postgres",
				name: "database",
				url: "postgres://dbUser:secretPasswordDontWorry@localhost:5432/backend",
				created_at: new Date().getTime(),
				updated_at: new Date().getTime(),
			});

			const db = yield* AppDatabase;
			const found = yield* db.execute(
				db.selectFrom("database_connections").selectAll(),
			);

			expect(found).toMatchInlineSnapshot(
				`"[[0,1],[1,9],[2,6],[3,7],[4,2],[5,3],[6,4],[7,5],[8,10],[9,8]]"`,
			);
		}).pipe(Effect.provide(testLayer));

		return test;
	});
});
