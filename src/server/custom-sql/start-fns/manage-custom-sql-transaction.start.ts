import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { toValidator } from "#src/db/effect-compat.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

import {
  beginCustomSqlTransaction,
  commitCustomSqlTransaction,
  rollbackCustomSqlTransaction,
  supportsPersistentCustomSqlTransactions,
} from "../transaction-session.ts";

const BeginCustomSqlTransactionInputSchema = Schema.Struct({
  url: Schema.String,
});

const ManageCustomSqlTransactionInputSchema = Schema.Struct({
  url: Schema.String,
  transactionId: Schema.String,
  action: Schema.Literals(["commit", "rollback"]),
});

const findConnection = (url: string) =>
  AppRuntime.runPromise(
    Effect.gen(function* () {
      const repository = yield* DatabaseConnectionRepository;
      const connection = yield* repository.findByUrl(url);
      if (!connection) throw new Error(`Connection not found for URL: ${url}`);
      return connection;
    }),
  );

export const beginCustomSqlTransactionServerFn = createServerFn({ method: "POST" })
  .validator(BeginCustomSqlTransactionInputSchema.pipe(toValidator))
  .handler(async (ctx) => {
    const connection = await findConnection(ctx.data.url);
    if (!supportsPersistentCustomSqlTransactions(connection.dialect)) {
      throw new Error("This database does not support persistent transactions in Dadabase.");
    }
    return beginCustomSqlTransaction({
      connectionId: connection.id,
      url: ctx.data.url,
      dialect: connection.dialect,
    });
  });

export const manageCustomSqlTransactionServerFn = createServerFn({ method: "POST" })
  .validator(ManageCustomSqlTransactionInputSchema.pipe(toValidator))
  .handler(async (ctx) => {
    const connection = await findConnection(ctx.data.url);
    const input = {
      transactionId: ctx.data.transactionId,
      connectionId: connection.id,
      url: ctx.data.url,
      dialect: connection.dialect,
    };
    return ctx.data.action === "commit"
      ? commitCustomSqlTransaction(input)
      : rollbackCustomSqlTransaction(input);
  });
