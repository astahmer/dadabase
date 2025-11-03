import { deleteDbConnection } from "#src/fns/pg/delete-db-connection.ts";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { AppRuntime } from "../runtime.ts";

export const deleteDbConnectionServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({ id: Schema.String }).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await AppRuntime.runPromise(deleteDbConnection(ctx.data.id));
	});
