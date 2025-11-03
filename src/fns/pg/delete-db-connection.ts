import { DatabaseConnectionsRepository } from "#src/db/database-connections.repository.ts";
import { Effect } from "effect";

export const deleteDbConnection = Effect.fn(function* (id: string) {
	const repository = yield* DatabaseConnectionsRepository;
	yield* repository.delete({
		id: id,
	});
});
