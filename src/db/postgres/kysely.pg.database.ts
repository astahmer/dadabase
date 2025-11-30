import { Context } from "effect";
import { type EffectKysely } from "../effect-kysely.ts";

export class KyselyPgDatabase extends Context.Tag("@dadabase/Database/pg")<
	KyselyPgDatabase,
	EffectKysely<any>
>() {}
