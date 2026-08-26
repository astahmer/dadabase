import { PgliteClient } from "@effect/sql-pglite";
// oxlint-disable
// import { vector } from "@electric-sql/pglite/vector";
import { Layer } from "effect";

import type { AppDatabaseSchema } from "./app.db.schema.ts";

import { AppDatabase } from "./app.db.ts";
import { makeEffectKyselyPglite } from "./effect-kysely.pglite.ts";

const pgliteKyselyLayer = Layer.effect(
  AppDatabase,
  makeEffectKyselyPglite<AppDatabaseSchema>({
    dataDir: "memory://",
    // extensions: { vector },
  }),
);
pgliteKyselyLayer;

// https://github.com/evelant/synchrotron/blob/a0ba9fe2a8515c7a900c74069e2f7cb850c6c147/packages/sql-pglite/src/PgliteClient.ts
export const pgliteLayer = PgliteClient.layer({
  // dataDir: "pglite-cache",
  dataDir: "memory://",
  // extensions: { vector },
  // transformQueryNames: String.camelToSnake,
  // transformResultNames: String.snakeToCamel,
});
// export const AppDbInMemoryLayer = pgliteKyselyLayer.pipe(
// 	Layer.provideMerge(pgliteLayer),
// );
