import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { AppRuntime } from "../../services/app.runtime.ts";

const findByNameDbConnectionServerFn = createServerFn({ method: "POST" })
  .inputValidator(Schema.Struct({ name: Schema.String }).pipe(Schema.standardSchemaV1))
  .handler(async (ctx) => {
    const getSavedConnections = Effect.gen(function* () {
      const repository = yield* DatabaseConnectionRepository;
      const output = yield* repository.findByName(ctx.data.name);
      return output;
    });
    return await AppRuntime.runPromise(getSavedConnections);
  });

export const findByNameDbConnectionQueryOptions = (input: { name: string }) =>
  queryOptions({
    queryKey: ["db", "find", input],
    queryFn: () => findByNameDbConnectionServerFn({ data: input }),
    staleTime: 60 * 1000 * 5, // 5 minutes
  });
