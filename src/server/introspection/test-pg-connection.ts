import { SqlError } from "@effect/sql";
import { Effect, Either } from "effect";
import { Pool } from "pg";

export const testPgConnectionUrl = (url: string) =>
  Effect.gen(function* () {
    const canConnect = yield* Effect.tryPromise({
      try: async () => {
        const pool = new Pool({ connectionString: url });
        const client = await pool.connect();
        await client.query("SELECT NOW()");
        client.release();
        return { success: true };
      },
      catch: (err) => new SqlError.SqlError({ cause: err }),
    }).pipe(Effect.either);

    if (Either.isLeft(canConnect)) {
      if (
        canConnect.left.cause &&
        typeof canConnect.left.cause === "object" &&
        "code" in canConnect.left.cause
      ) {
        if (canConnect.left.cause.code === "ECONNREFUSED") {
          return {
            success: false,
            message: "Connection refused (ECONNREFUSED)",
          } as const;
        }
      }

      return {
        success: false,
        message: canConnect.left.message || (canConnect.left.cause as any)?.message,
      } as const;
    }

    return { success: true, message: "OK" } as const;
  });
