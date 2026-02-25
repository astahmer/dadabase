import type { Config as DrizzleConfig } from "drizzle-kit";

import { Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect, Redacted } from "effect";

import { DatabaseUrl } from "./src/db/app.db.config.ts";

const getConfig = Effect.gen(function* () {
  const path = yield* Path.Path;
  const schemaPath = path.resolve(process.cwd(), "./src/db/app.db.schema.ts");

  const url = yield* DatabaseUrl;

  const base = {
    dialect: "sqlite",
    schema: schemaPath,
    out: "./migrations",
    verbose: true,
    dbCredentials: {
      url: Redacted.value(url),
    },
  } satisfies DrizzleConfig;

  // console.log(base);

  return base;
});

const drizzleConfig = Effect.runSync(getConfig.pipe(Effect.provide(NodeContext.layer)));

export default drizzleConfig;
