import { DatabaseConnectionsRepository } from "#src/db/database-connections.repository.ts";
import { AppRuntime } from "#src/server-fns/runtime.ts";
import { Effect } from "effect";

const runWithDb = Effect.gen(function* () {
	const repository = yield* DatabaseConnectionsRepository;
	yield* repository.insert({
		dialect: "postgres",
		name: "emisoup",
		url: "postgres://dbUser:secretPasswordDontWorry@localhost:5432/backend",
	});
	const list = yield* repository.findAll();
	console.log(list);
});

const res = await AppRuntime.runPromise(runWithDb);
console.log(res);
