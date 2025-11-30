import { QueryLogger } from "#src/server/query-logger/query-logger.service.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

const getQueryHistoryServerFn = createServerFn({
	method: "GET",
}).handler(async () => {
	return AppRuntime.runPromise(
		Effect.gen(function* () {
			const queryLogger = yield* QueryLogger;
			return yield* queryLogger.history;
		}),
	);
});

export const getQueryHistoryQueryOptions = (
	// input: InferServerFnSchema<typeof getQueryHistoryServerFn>,
) =>
	queryOptions({
		queryKey: ["app", "queryHistory"],
		queryFn: () => getQueryHistoryServerFn({}),
		staleTime: 60 * 1000, // 1 minute
	});

// export const
