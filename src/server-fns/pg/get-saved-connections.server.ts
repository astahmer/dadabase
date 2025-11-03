import { DatabaseConnectionsRepository } from "#src/db/database-connections.repository.ts";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { AppRuntime } from "../runtime.ts";
import { queryOptions } from "@tanstack/react-query";

const getSavedConnectionsServerFn = createServerFn().handler(async (_ctx) => {
	const getSavedConnections = Effect.gen(function* () {
		const repository = yield* DatabaseConnectionsRepository;
		const list = yield* repository.findAll();
		return list;
	});
	return await AppRuntime.runPromise(getSavedConnections);
});

export const getSavedConnectionsQueryOptions = queryOptions({
	queryKey: ["db", "list"],
	queryFn: getSavedConnectionsServerFn,
});
