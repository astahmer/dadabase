import { createServerFn } from "@tanstack/react-start";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { QueryLogger } from "#src/server/query-logger/query-logger.service.ts";
import { Effect } from "effect";

export const getQueryHistoryServerFn = createServerFn({
	method: "GET",
}).handler(async () => {
	return AppRuntime.runPromise(
		Effect.gen(function* () {
			const logger = yield* QueryLogger;
			return yield* logger.history;
		}),
	);
});
