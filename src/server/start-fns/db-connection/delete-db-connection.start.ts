import { deleteDbConnection } from "#src/server/fns/db-connection/delete-db-connection.ts";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { AppRuntime } from "../runtime.ts";
import { mutationOptions } from "@tanstack/react-query";

const deleteDbConnectionServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({ id: Schema.String }).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await AppRuntime.runPromise(deleteDbConnection(ctx.data.id));
	});

export const deleteDbConnectionMutation = mutationOptions({
	mutationFn: deleteDbConnectionServerFn,
});
