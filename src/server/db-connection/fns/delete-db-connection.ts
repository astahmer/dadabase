import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { Effect } from "effect";

export const deleteDbConnection = Effect.fn(function* (id: string) {
	const repository = yield* DatabaseConnectionRepository;
	yield* repository.delete({
		id: id,
	});
});
