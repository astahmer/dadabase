import { createClient } from "@libsql/client";
import { Effect, Result } from "effect";

import { SqlError } from "#src/db/effect-compat.ts";

export const testLibsqlConnectionUrl = (url: string) =>
  Effect.gen(function* () {
    const canConnect = yield* Effect.tryPromise({
      try: async () => {
        const client = createClient({ url });
        await client.execute("SELECT 1");
        return { success: true };
      },
      catch: (err) => new SqlError({ cause: err }),
    }).pipe(Effect.result);

    if (Result.isFailure(canConnect)) {
      if (canConnect.failure.cause && typeof canConnect.failure.cause === "object") {
        const cause = canConnect.failure.cause as any;
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
          canConnect.failure.message ||
          (canConnect.failure.cause as any)?.message ||
          "Unknown connection error",
      } as const;
    }

    return { success: true, message: "OK" } as const;
  });
