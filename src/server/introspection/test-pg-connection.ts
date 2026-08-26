import { Effect, Result } from "effect";
import { Pool } from "pg";

import { SqlError } from "#src/db/effect-compat.ts";

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
      catch: (err) => new SqlError({ cause: err }),
    }).pipe(Effect.result);

    if (Result.isFailure(canConnect)) {
      if (
        canConnect.failure.cause &&
        typeof canConnect.failure.cause === "object" &&
        "code" in canConnect.failure.cause
      ) {
        if (canConnect.failure.cause.code === "ECONNREFUSED") {
          return {
            success: false,
            message: "Connection refused (ECONNREFUSED)",
          } as const;
        }
      }

      return {
        success: false,
        message: canConnect.failure.message || (canConnect.failure.cause as any)?.message,
      } as const;
    }

    return { success: true, message: "OK" } as const;
  });
