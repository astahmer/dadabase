import { QueryLogger } from "#src/server/query-logger/query-logger.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { withRemoteConnectionLayersFromUrl } from "#src/server/create-remote-server-fn.ts";
import type { InferServerFnSchema } from "#src/types.ts";

const clearQueryHistoryInputSchema = Schema.Struct({
	url: Schema.String,
});

const clearQueryHistoryServerFn = createServerFn({ method: "POST" })
	.inputValidator(clearQueryHistoryInputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx: any) => {
		const program = Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;
			return yield* queryLogger.clearAll();
		}).pipe(withRemoteConnectionLayersFromUrl(ctx.data.url));

		return AppRuntime.runPromise(program);
	});

export const clearQueryHistoryMutation = (
	input: InferServerFnSchema<typeof clearQueryHistoryServerFn>,
) => clearQueryHistoryServerFn({ data: input });
