import type { PGliteOptions } from "@electric-sql/pglite";

import { Effect } from "effect";
import { Kysely } from "kysely";

import { makeFromKysely } from "./effect-kysely.ts";

export const makeEffectKyselyPglite = <T>(
  input?: PGliteOptions & {
    setup?: (qb: Kysely<T>) => Promise<void>;
  },
) =>
  Effect.gen(function* () {
    const { KyselyPGlite } = yield* Effect.tryPromise(() => import("kysely-pglite"));
    const { setup, ...pgLiteOptions } = input ?? {};
    const { dialect } = yield* Effect.tryPromise(() => KyselyPGlite.create(pgLiteOptions));

    const qb = new Kysely<T>({
      dialect,
    });

    if (setup) {
      yield* Effect.tryPromise(() => setup(qb));
    }

    return makeFromKysely(qb);
  });
