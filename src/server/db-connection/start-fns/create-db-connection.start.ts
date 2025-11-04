import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { AppRuntime } from "../../services/app.runtime.ts";
import { createDbConnection } from "#src/server/db-connection/fns/create-db-connection.ts";
import { mutationOptions } from "@tanstack/react-query";

const createDbConnectionServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({
			name: Schema.String,
			url: Schema.URL,
		}).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await AppRuntime.runPromise(
			createDbConnection({
				name: ctx.data.name,
				url: ctx.data.url.toString(),
			}),
		);
	});

export const createDbConnectionMutation = mutationOptions({
	mutationFn: createDbConnectionServerFn,
});
