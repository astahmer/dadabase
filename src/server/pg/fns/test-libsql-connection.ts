import { SqlError } from "@effect/sql";
import { Effect, Either } from "effect";
import { createClient } from "@libsql/client";

export const testLibsqlConnectionUrl = (url: string) =>
	Effect.gen(function* () {
		const canConnect = yield* Effect.tryPromise({
			try: async () => {
				const client = createClient({
					url,
				});
				await client.execute("SELECT 1");
				return { success: true };
			},
			catch: (err) => new SqlError.SqlError({ cause: err }),
		}).pipe(Effect.either);

		if (Either.isLeft(canConnect)) {
			if (
				canConnect.left.cause &&
				typeof canConnect.left.cause === "object"
			) {
				const cause = canConnect.left.cause as any;
				if (cause.code === "SQLITE_CANTOPEN") {
					return {
						success: false,
						message: "Cannot open database file (SQLITE_CANTOPEN)",
					} as const;
				}
				if (cause.code === "SQLITE_IOERR") {
					return {
						success: false,
						message: "I/O error accessing database (SQLITE_IOERR)",
					} as const;
				}
				if (cause.message) {
					return {
						success: false,
						message: cause.message,
					} as const;
				}
			}

			return {
				success: false,
				message:
					canConnect.left.message ||
					(canConnect.left.cause as any)?.message ||
					"Unknown connection error",
			} as const;
		}

		return { success: true, message: "OK" } as const;
	});
