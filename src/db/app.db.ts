import { Context } from "effect";

import type { AppDatabaseSchema } from "./app.db.schema.ts";
import type { EffectKysely } from "./effect-kysely.ts";

export class AppDatabase extends Context.Service<AppDatabase, EffectKysely<AppDatabaseSchema>>()(
  "@dadabase/Database/app",
) {}
