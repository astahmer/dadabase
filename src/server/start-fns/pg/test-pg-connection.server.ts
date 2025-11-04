import { testPgConnectionUrl } from "#src/server/fns/pg/test-pg-connection.ts";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { AppRuntime } from "../runtime.ts";

export const testPgConnectionServerFn = createServerFn()
	.inputValidator(
		Schema.Struct({ url: Schema.String }).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		return await AppRuntime.runPromise(testPgConnectionUrl(ctx.data.url));
	});
