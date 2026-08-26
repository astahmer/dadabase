import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { SqlError, toValidator } from "#src/db/effect-compat.ts";
import { guardReadOnlyMutation } from "#src/lib/connection-security.ts";
import { createRemoteIntrospectionHandler } from "#src/server/create-remote-server-fn.ts";
import { executeSqliteTableRebuild } from "#src/server/introspection/introspection.ts";

export const executeSqliteTableRebuildServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      statements: Schema.Array(Schema.String),
    }).pipe(toValidator),
  )
  .handler(
    createRemoteIntrospectionHandler((input) =>
      Effect.gen(function* () {
        const readOnlyError = guardReadOnlyMutation(input.url);
        if (readOnlyError) return yield* Effect.fail(new SqlError({ cause: readOnlyError }));

        return yield* executeSqliteTableRebuild({
          statements: input.statements,
        });
      }),
    ),
  );
