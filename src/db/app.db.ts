import { Context } from "effect";
import { type EffectKysely } from "./effect-kysely.ts";
import type { AppDatabaseSchema } from "./app.db.schema.ts";

export class AppDatabase extends Context.Tag("@dadabase/Database/app")<
	AppDatabase,
	EffectKysely<AppDatabaseSchema>
>() {}
