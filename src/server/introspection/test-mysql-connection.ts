import { SqlError } from "@effect/sql";
import { Effect, Either } from "effect";
import mysql from "mysql2/promise";

export const testMysqlConnectionUrl = (url: string) =>
  Effect.gen(function* () {
    const canConnect = yield* Effect.tryPromise({
      try: async () => {
        const connection = await mysql.createConnection(url);
        await connection.query("SELECT 1");
        await connection.end();
        return { success: true };
      },
      catch: (err) => new SqlError.SqlError({ cause: err }),
    }).pipe(Effect.either);

    if (Either.isLeft(canConnect)) {
      const cause = canConnect.left.cause;
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "ECONNREFUSED") {
        return {
          success: false,
          message: "Connection refused (ECONNREFUSED)",
        } as const;
      }

      return {
        success: false,
        message: canConnect.left.message || (cause as { message?: string } | null)?.message,
      } as const;
    }

    return { success: true, message: "OK" } as const;
  });
