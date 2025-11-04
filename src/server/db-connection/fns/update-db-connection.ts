import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { Effect } from "effect";

export const updateDbConnection = Effect.fn(function* (input: {
	id: string;
	name: string;
	url: string;
}) {
	const repository = yield* DatabaseConnectionRepository;
	yield* repository.update({
		id: input.id,
		name: input.name,
		url: input.url,
	});
});
