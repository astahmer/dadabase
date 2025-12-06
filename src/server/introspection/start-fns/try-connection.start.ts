import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { AppRuntime } from "../../services/app.runtime.ts";
import { tryConnectionUrl } from "../try-connection.ts";

export const tryConnectionServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({
			url: Schema.String,
			dialect: Schema.Enums(DatabaseDialect),
		}).pipe(Schema.standardSchemaV1),
	)
	.handler((ctx) => AppRuntime.runPromise(tryConnectionUrl(ctx.data)));
