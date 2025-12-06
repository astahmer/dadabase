import { DatabaseDialect } from "#src/db/dialect.ts";
import { Effect } from "effect";
import { testLibsqlConnectionUrl } from "./test-libsql-connection.ts";
import { testPgConnectionUrl } from "./test-pg-connection.ts";

export const tryConnectionUrl = (input: {
	url: string;
	dialect: DatabaseDialect;
}) =>
	Effect.gen(function* () {
		if (input.dialect === DatabaseDialect.Postgres) {
			return yield* testPgConnectionUrl(input.url);
		}
		if (
			input.dialect === DatabaseDialect.SQLite ||
			input.dialect === DatabaseDialect.LibSQL
		) {
			return yield* testLibsqlConnectionUrl(input.url);
		}

		return {
			success: false,
			message: "Unsupported database dialect",
		};
	});
