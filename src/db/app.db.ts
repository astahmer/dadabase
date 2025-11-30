import { Context } from "effect";
import { type EffectKysely } from "./effect-kysely.ts";

export class AppDatabase extends Context.Tag("@dadabase/Database/app")<
	AppDatabase,
	EffectKysely<any>
>() {}
