import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { AppRuntime } from "../runtime.ts";
import { saveDbConnection } from "#src/fns/pg/save-db-connection.ts";

export const saveDbConnectionServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({
			name: Schema.String,
			url: Schema.URL,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await AppRuntime.runPromise(
			saveDbConnection({
				name: ctx.data.name,
				url: ctx.data.url.toString(),
			}),
		);
	});
