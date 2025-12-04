import { testPgConnectionUrl } from "#src/server/introspection/test-pg-connection.ts";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { AppRuntime } from "../../services/app.runtime.ts";

export const testPgConnectionServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({ url: Schema.String }).pipe(Schema.standardSchemaV1),
	)
	.handler((ctx) => AppRuntime.runPromise(testPgConnectionUrl(ctx.data.url)));
