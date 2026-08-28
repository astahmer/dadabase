import type * as SqlConnection from "effect/unstable/sql/SqlConnection";

import { Context, Effect, Exit, Layer, Scope } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { randomUUID } from "node:crypto";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { PoolCache } from "#src/db/postgres/pool-cache.ts";
import { makeRemoteSqlClientLayer } from "#src/db/postgres/remote-sql-client.layer.ts";
import { isReadOnlyConnection } from "#src/lib/connection-security.ts";
import { splitSqlStatements } from "#src/lib/sql-statements.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";

const TRANSACTION_IDLE_TTL_MS = 15 * 60 * 1000;

export interface CustomSqlTransactionResult {
  rows: unknown[];
  columns: string[];
  rowCount: number;
  rowsAffected?: number;
  timeTaken: number;
  ranAt: number;
}

export interface CustomSqlTransactionInfo {
  transactionId: string;
  startedAt: number;
  expiresAt: number;
}

type TransactionSession = CustomSqlTransactionInfo & {
  connectionId: string;
  url: string;
  scope: Scope.Closeable;
  connection: SqlConnection.Connection;
  lock: Promise<void>;
  timer: ReturnType<typeof setTimeout>;
};

const sessions = new Map<string, TransactionSession>();

const transactionSql = (action: "begin" | "commit" | "rollback", dialect: DatabaseDialect) => {
  if (dialect === DatabaseDialect.Mssql) {
    return action === "begin"
      ? "BEGIN TRANSACTION"
      : action === "commit"
        ? "COMMIT TRANSACTION"
        : "ROLLBACK TRANSACTION";
  }
  return action === "begin" ? "BEGIN" : action.toUpperCase();
};

const touch = (session: TransactionSession) => {
  session.expiresAt = Date.now() + TRANSACTION_IDLE_TTL_MS;
  clearTimeout(session.timer);
  session.timer = setTimeout(() => {
    void expireTransaction(session.transactionId);
  }, TRANSACTION_IDLE_TTL_MS);
  session.timer.unref?.();
};

const withSessionLock = async <A>(session: TransactionSession, effect: () => Promise<A>) => {
  const previous = session.lock;
  let release!: () => void;
  session.lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    touch(session);
    await AppRuntime.runPromise(
      Effect.gen(function* () {
        const poolCache = yield* PoolCache;
        yield* poolCache.touch(session.url);
      }),
    ).catch(() => undefined);
    return await effect();
  } finally {
    release();
  }
};

const closeScope = async (scope: Scope.Closeable) => {
  await AppRuntime.runPromise(Scope.close(scope, Exit.void)).catch(() => undefined);
};

const removeSession = (session: TransactionSession) => {
  clearTimeout(session.timer);
  sessions.delete(session.transactionId);
};

const getSession = (input: { transactionId: string; connectionId: string; url: string }) => {
  const session = sessions.get(input.transactionId);
  if (!session || session.connectionId !== input.connectionId || session.url !== input.url) {
    throw new Error("Transaction session not found or does not belong to this connection.");
  }
  return session;
};

const executeRaw = (connection: SqlConnection.Connection, sql: string) =>
  AppRuntime.runPromise(connection.executeRaw(sql, []));

const normalizeResult = (
  sql: string,
  raw: unknown,
  startedAt: number,
): CustomSqlTransactionResult => {
  const result = (raw ?? {}) as {
    rows?: unknown[];
    rowCount?: number;
    rowsAffected?: number;
    affectedRows?: number;
  };
  const endedAt = Date.now();
  if (/^\s*(SELECT|WITH)\s+/i.test(sql)) {
    const rows = result.rows ?? [];
    return {
      rows,
      columns: rows.length > 0 ? Object.keys(rows[0] as object) : [],
      rowCount: rows.length,
      timeTaken: endedAt - startedAt,
      ranAt: startedAt,
    };
  }
  return {
    rows: [],
    columns: [],
    rowCount: 0,
    rowsAffected: result.rowCount ?? result.rowsAffected ?? result.affectedRows ?? 0,
    timeTaken: endedAt - startedAt,
    ranAt: startedAt,
  };
};

export const supportsPersistentCustomSqlTransactions = (dialect: DatabaseDialect) =>
  dialect !== DatabaseDialect.Clickhouse;

export const beginCustomSqlTransaction = async (input: {
  connectionId: string;
  url: string;
  dialect: DatabaseDialect;
}): Promise<CustomSqlTransactionInfo> => {
  if (!supportsPersistentCustomSqlTransactions(input.dialect)) {
    throw new Error("This database does not support persistent transactions in Dadabase.");
  }
  if (isReadOnlyConnection(input.url)) {
    throw new Error("This connection is read-only. Enable write access to start a transaction.");
  }

  const scope = await AppRuntime.runPromise(Scope.make());
  try {
    const connection = await AppRuntime.runPromise(
      Effect.gen(function* () {
        const sqlLayer = yield* makeRemoteSqlClientLayer(input.url, input.dialect);
        const context = yield* Layer.buildWithScope(sqlLayer, scope);
        const client = Context.get(context, SqlClient.SqlClient);
        const reserved = yield* Scope.provide(scope)(client.reserve);
        yield* reserved.executeRaw(transactionSql("begin", input.dialect), []);
        return reserved;
      }),
    );

    const transactionId = randomUUID();
    const now = Date.now();
    const session = {
      transactionId,
      startedAt: now,
      expiresAt: now + TRANSACTION_IDLE_TTL_MS,
      connectionId: input.connectionId,
      url: input.url,
      scope,
      connection,
      lock: Promise.resolve(),
      timer: setTimeout(() => {
        void expireTransaction(transactionId);
      }, TRANSACTION_IDLE_TTL_MS),
    } satisfies TransactionSession;
    session.timer.unref?.();
    sessions.set(transactionId, session);
    return {
      transactionId,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
    };
  } catch (error) {
    await closeScope(scope);
    throw error;
  }
};

export const executeCustomSqlInTransaction = async (input: {
  transactionId: string;
  connectionId: string;
  url: string;
  sql: string;
}): Promise<CustomSqlTransactionResult> => {
  const session = getSession(input);
  const statements = splitSqlStatements(input.sql);
  if (statements.length !== 1) {
    throw new Error("Run one statement at a time while a transaction is active.");
  }
  const statement = statements[0];
  if (!statement) {
    throw new Error("A transaction query cannot be empty.");
  }
  return withSessionLock(session, async () => {
    const startedAt = Date.now();
    const raw = await executeRaw(session.connection, statement.sql);
    return normalizeResult(statement.sql, raw, startedAt);
  });
};

const finishTransaction = async (input: {
  transactionId: string;
  connectionId: string;
  url: string;
  dialect: DatabaseDialect;
  action: "commit" | "rollback";
}) => {
  const session = getSession(input);
  return withSessionLock(session, async () => {
    try {
      await executeRaw(session.connection, transactionSql(input.action, input.dialect));
    } catch (error) {
      if (input.action === "commit") {
        await executeRaw(session.connection, transactionSql("rollback", input.dialect)).catch(
          () => undefined,
        );
      }
      throw error;
    } finally {
      removeSession(session);
      await closeScope(session.scope);
    }
    return { transactionId: session.transactionId, action: input.action } as const;
  });
};

export const commitCustomSqlTransaction = (
  input: Omit<Parameters<typeof finishTransaction>[0], "action">,
) => finishTransaction({ ...input, action: "commit" });

export const rollbackCustomSqlTransaction = (
  input: Omit<Parameters<typeof finishTransaction>[0], "action">,
) => finishTransaction({ ...input, action: "rollback" });

const expireTransaction = async (transactionId: string) => {
  const session = sessions.get(transactionId);
  if (!session) return;
  try {
    await withSessionLock(session, async () => {
      try {
        await executeRaw(session.connection, "ROLLBACK");
      } finally {
        removeSession(session);
        await closeScope(session.scope);
      }
    });
  } catch {
    removeSession(session);
    await closeScope(session.scope);
  }
};
