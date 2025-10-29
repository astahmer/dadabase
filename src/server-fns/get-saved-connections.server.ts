import { Effect } from "effect";
import { AppRuntime } from "./runtime.ts";
import { createServerFn } from "@tanstack/react-start";
import { DatabaseConnectionsRepository } from "#src/db/database-connections.repository.ts";

export const getSavedConnectionsServerFn = createServerFn().handler(
	async (ctx) => {
		const getSavedConnections = Effect.gen(function* () {
			const repository = yield* DatabaseConnectionsRepository;
			return yield* repository.findAll();
		});
		return await AppRuntime.runPromise(getSavedConnections);
	},
);
