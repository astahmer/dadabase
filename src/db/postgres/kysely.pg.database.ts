import { Context } from "effect";

import type { EffectKysely } from "../effect-kysely.ts";

export class KyselyPgDatabase extends Context.Service<KyselyPgDatabase, EffectKysely<any>>()(
  "@dadabase/Database/pg",
) {}
