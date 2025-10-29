import { Context } from "effect";
import { type EffectKysely } from "../effect-kysely.ts";
import type { KyselyPgSchema } from "./kysely.pg.schema.ts";

export class KyselyPgDatabase extends Context.Tag("@dadabase/Database/pg")<
	KyselyPgDatabase,
	EffectKysely<KyselyPgSchema>
>() {}
