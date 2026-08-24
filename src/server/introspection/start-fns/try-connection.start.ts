import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { toValidator } from "#src/db/effect-compat.ts";

import { AppRuntime } from "../../services/app.runtime.ts";
import { tryConnectionUrl } from "../try-connection.ts";

export const tryConnectionServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      url: Schema.String,
      dialect: Schema.Enum(DatabaseDialect),
    }).pipe(toValidator),
  )
  .handler((ctx) => AppRuntime.runPromise(tryConnectionUrl(ctx.data)));
