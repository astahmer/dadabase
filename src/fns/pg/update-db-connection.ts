import { DatabaseConnectionsRepository } from "#src/db/database-connections.repository.ts";
import { Effect } from "effect";

export const updateDbConnection = Effect.fn(function* (input: {
	id: string;
	name: string;
	url: string;
}) {
	const repository = yield* DatabaseConnectionsRepository;
	yield* repository.update({
		id: input.id,
		name: input.name,
		url: input.url,
	});
});
