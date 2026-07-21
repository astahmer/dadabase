import { Effect } from "effect";

import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";

export const deleteDbConnection = Effect.fn(function* (id: string) {
  const repository = yield* DatabaseConnectionRepository;
  yield* repository.delete({
    id: id,
  });
});
