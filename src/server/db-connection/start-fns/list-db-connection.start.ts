import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { AppRuntime } from "../../services/app.runtime.ts";
import { queryOptions } from "@tanstack/react-query";

const listDbConnectionServerFn = createServerFn({ method: "POST" }).handler(
	async (_ctx) => {
		const getSavedConnections = Effect.gen(function* () {
			const repository = yield* DatabaseConnectionRepository;
			const list = yield* repository.findAll();
			return list;
		});
		return await AppRuntime.runPromise(getSavedConnections);
	},
);

export const listDbConnectionQueryOptions = queryOptions({
	queryKey: ["db", "list"],
	queryFn: listDbConnectionServerFn,
	staleTime: 60 * 1000 * 5, // 5 minutes
});
