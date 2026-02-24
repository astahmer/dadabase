import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { NanoId } from "#src/server/services/nano-id.ts";
import { Effect } from "effect";

export const createDbConnection = Effect.fn(function* (input: {
  name: string;
  url: string;
  dialect: DatabaseDialect;
}) {
  const repository = yield* DatabaseConnectionRepository;
  const nanoId = yield* NanoId;
  const now = new Date();
  const id = yield* nanoId.generate("db_conn");
  yield* repository.insert({
    id: id,
    dialect: input.dialect,
    name: input.name,
    url: input.url,
    created_at: now.getTime(),
    updated_at: now.getTime(),
  });

  return;
});
