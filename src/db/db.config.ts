import { Config, Redacted } from "effect";

export const DatabaseUrl = Config.redacted("DB_URL").pipe(
	Config.withDefault(
		Redacted.make("postgres://user:password@localhost:5438/db_dev"),
	),
);
