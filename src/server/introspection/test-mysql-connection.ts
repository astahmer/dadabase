import { Effect, Result } from "effect";
import mysql from "mysql2/promise";

import { SqlError } from "#src/db/effect-compat.ts";

export const testMysqlConnectionUrl = (url: string) =>
  Effect.gen(function* () {
    const canConnect = yield* Effect.tryPromise({
      try: async () => {
        const connection = await mysql.createConnection(url);
        await connection.query("SELECT 1");
        await connection.end();
        return { success: true };
      },
      catch: (err) => new SqlError({ cause: err }),
    }).pipe(Effect.result);

    if (Result.isFailure(canConnect)) {
      const cause = canConnect.failure.cause;
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "ECONNREFUSED") {
        return {
          success: false,
          message: "Connection refused (ECONNREFUSED)",
        } as const;
      }

      return {
        success: false,
        message: canConnect.failure.message || (cause as { message?: string } | null)?.message,
      } as const;
    }

    return { success: true, message: "OK" } as const;
  });
