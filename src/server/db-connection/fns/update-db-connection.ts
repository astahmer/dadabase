import { Effect } from "effect";

import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";

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
