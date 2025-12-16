import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { withRemoteConnectionLayersFromUrl } from "#src/server/create-remote-server-fn.ts";
import { getQueryHistoryQueryOptions } from "#src/server/introspection/start-fns/get-query-history.start.ts";
import { QueryLogger } from "#src/server/query-logger/query-logger.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import type { InferServerFnSchema } from "#src/types.ts";

const clearQueryHistoryInputSchema = Schema.Struct({
	url: Schema.String,
});

const clearQueryHistoryServerFn = createServerFn({ method: "POST" })
	.inputValidator(clearQueryHistoryInputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx) => {
		const program = Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;
			return yield* queryLogger.clearAll();
		}).pipe(withRemoteConnectionLayersFromUrl(ctx.data.url));

		await AppRuntime.runPromise(program);
		return true;
	});

export const clearQueryHistoryQueryOptions = (
	input: InferServerFnSchema<typeof clearQueryHistoryServerFn>,
) =>
	queryOptions({
		queryKey: ["remote", "clearQueryHistory", input],
		queryFn: (ctx) =>
			clearQueryHistoryServerFn({ data: input }).then(() =>
				ctx.client.invalidateQueries(
					getQueryHistoryQueryOptions({ url: input.url }),
				),
			),
		enabled: false,
	});
