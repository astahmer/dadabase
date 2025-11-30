import { QueryLogger } from "#src/server/query-logger/query-logger.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { withRemoteConnectionLayersFromUrl } from "#src/server/create-remote-server-fn.ts";
import type { InferServerFnSchema } from "#src/types.ts";

const getQueryHistoryServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		Schema.Struct({ url: Schema.String }).pipe(Schema.standardSchemaV1),
	)
	.handler(async (ctx) => {
		const program = Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;
			return yield* queryLogger.get;
		}).pipe(withRemoteConnectionLayersFromUrl(ctx.data.url));

		return AppRuntime.runPromise(program);
	});

export const getQueryHistoryQueryOptions = (
	input: InferServerFnSchema<typeof getQueryHistoryServerFn>,
) =>
	queryOptions({
		queryKey: ["app", "queryHistory", input],
		queryFn: () => getQueryHistoryServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
