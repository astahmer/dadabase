import { Context, Layer, Schema } from "effect";

import type { DatabaseDialect } from "#src/db/dialect.ts";

export const RemoteConnectionId = Schema.String.pipe(Schema.brand("ConnectionId"));
export type RemoteConnectionIdType = typeof RemoteConnectionId.Type;

export class RemoteConnection extends Context.Service<
  RemoteConnection,
  typeof RemoteConnectionId.Type
>()("@dadabase/ConnectionId") {}

export const makeRemoteConnectionLayer = (connectionId: typeof RemoteConnectionId.Type) =>
  Layer.succeed(RemoteConnection, connectionId);

/**
 * Actual dialect of the remote connection the handler is serving. Needed where
 * SQL dispatch alone cannot distinguish branches — e.g. the DuckDB client shim
 * reuses the pg statement compiler (`dialect: "pg"`), so `sql.onDialectOrElse`
 * selects pg branches even though the target database is DuckDB.
 */
export class RemoteDialect extends Context.Service<RemoteDialect, DatabaseDialect>()(
  "@dadabase/RemoteDialect",
) {}

export const makeRemoteDialectLayer = (dialect: DatabaseDialect) =>
  Layer.succeed(RemoteDialect, dialect);
