import { makeKyselyDatabase } from "#src/db/kysely.database.live.ts";
import { KyselyDatabase } from "#src/db/kysely.database.ts";
import { SqlError } from "@effect/sql";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

export const getAvailableDatabaseList = Effect.gen(function* () {
	const db = yield* KyselyDatabase;
	const rows = yield* db.execute(
		db.selectFrom("pg_catalog.pg_database").select("datname"),
	);
	return rows;
});

export const getAvailableDatabaseListServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({ url: Schema.String }).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await Effect.runPromise(
			getAvailableDatabaseList.pipe(
				Effect.provide(makeKyselyDatabase(ctx.data.url)),
			),
		);
	});

export const getAvailableTableList = Effect.gen(function* () {
	const db = yield* KyselyDatabase;
	const tableList = yield* Effect.tryPromise({
		try: () => db.introspection.getTables(),
		catch: (e) =>
			new SqlError.SqlError({ cause: e, message: "Couldn't get table list" }),
	});
	return tableList;
});
