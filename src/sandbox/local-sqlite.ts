import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { NanoId } from "#src/server/services/nano-id.ts";
import { Effect } from "effect";

const runWithDb = Effect.gen(function* () {
	const repository = yield* DatabaseConnectionRepository;
	const nanoId = yield* NanoId;

	const now = new Date();
	const id = yield* nanoId.generate("db_conn");
	yield* repository.insert({
		id: id,
		dialect: DatabaseDialect.Postgres,
		name: "database",
		url: "postgres://dbUser:secretPasswordDontWorry@localhost:5432/backend",
		created_at: now.getTime(),
		updated_at: now.getTime(),
	});
	const list = yield* repository.findAll();
	console.log(list);
});

const res = await AppRuntime.runPromise(runWithDb);
console.log(res);
