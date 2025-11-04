import { DatabaseConnectionsRepository } from "#src/db/database-connections.repository.ts";
import { AppRuntime } from "#src/server/start-fns/runtime.ts";
import { NanoId } from "#src/services/nano-id.ts";
import { Effect } from "effect";

const runWithDb = Effect.gen(function* () {
	const repository = yield* DatabaseConnectionsRepository;
	const nanoId = yield* NanoId;

	const now = new Date();
	const id = yield* nanoId.generate("db_conn");
	yield* repository.insert({
		id: id,
		dialect: "postgres",
		name: "emisoup",
		url: "postgres://dbUser:secretPasswordDontWorry@localhost:5432/backend",
		created_at: now.getTime(),
		updated_at: now.getTime(),
	});
	const list = yield* repository.findAll();
	console.log(list);
});

const res = await AppRuntime.runPromise(runWithDb);
console.log(res);
