import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { AppRuntime } from "../runtime.ts";
import { updateDbConnection } from "#src/server/fns/db-connection/update-db-connection.ts";
import { mutationOptions } from "@tanstack/react-query";

const updateDbConnectionServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({
			id: Schema.String,
			name: Schema.String,
			url: Schema.URL,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await AppRuntime.runPromise(
			updateDbConnection({
				id: ctx.data.id,
				name: ctx.data.name,
				url: ctx.data.url.toString(),
			}),
		);
	});

export const updateDbConnectionMutation = mutationOptions({
	mutationFn: updateDbConnectionServerFn,
});
