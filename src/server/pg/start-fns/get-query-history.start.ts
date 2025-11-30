import { QueryLogger } from "#src/server/query-logger/query-logger.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { withRemoteConnectionLayersFromUrl } from "#src/server/create-remote-server-fn.ts";
import type { InferServerFnSchema } from "#src/types.ts";
import type { QueryLogFilters } from "#src/server/query-logger/query-logger.types.ts";

const QueryLogFiltersSchema = Schema.Struct({
	type: Schema.optional(
		Schema.Union(Schema.String, Schema.Array(Schema.String)),
	),
	status: Schema.optional(
		Schema.Union(Schema.String, Schema.Array(Schema.String)),
	),
	schema: Schema.optional(Schema.String),
	table: Schema.optional(Schema.String),
});

const getQueryHistoryInputSchema = Schema.Struct({
	url: Schema.String,
	filters: Schema.optional(QueryLogFiltersSchema),
});

const getQueryHistoryServerFn = createServerFn({ method: "POST" })
	.inputValidator(getQueryHistoryInputSchema.pipe(Schema.standardSchemaV1))
	.handler(async (ctx: any) => {
		const program = Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;
			return yield* queryLogger.get(
				ctx.data.filters as QueryLogFilters | undefined,
			);
		}).pipe(withRemoteConnectionLayersFromUrl(ctx.data.url));

		const result = await AppRuntime.runPromise(program);
		return result.map((res) => ({
			...res,
			startTime: new Date(res.startTime),
			endTime: res.endTime ? new Date(res.endTime) : undefined,
		}));
	});

export const getQueryHistoryQueryOptions = (
	input: InferServerFnSchema<typeof getQueryHistoryServerFn>,
) =>
	queryOptions({
		queryKey: ["app", "queryHistory", input],
		queryFn: () => getQueryHistoryServerFn({ data: input }),
		staleTime: 60 * 1000, // 1 minute
	});
