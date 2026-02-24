import type { SqlClient } from "@effect/sql";

import { PgLiteClient } from "@dadabase/effect-pglite";
import { LibsqlClient } from "@effect/sql-libsql";
import { Layer } from "effect";

import {
  makeRemoteConnectionLayer,
  RemoteConnectionId,
} from "../db-connection/remote-connection.tag.ts";
import { QueryLoggerNoopLayer } from "../query-logger/query-logger.layer.noop.ts";

export interface DatabaseTestConfig {
  defaultSchema: string;
  isPostgres: boolean;
}

export const postgresConfig: DatabaseTestConfig = {
  defaultSchema: "public",
  isPostgres: true,
};

export const sqliteConfig: DatabaseTestConfig = {
  defaultSchema: "main",
  isPostgres: false,
};

// PgLite layer for introspection tests
export const pgliteLayer = PgLiteClient.layer({
  dataDir: "memory://",
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

// LibSQL layer for SQLite introspection tests
export const libsqlLayer = LibsqlClient.layer({
  url: ":memory:",
}) as unknown as Layer.Layer<SqlClient.SqlClient>;

export const makeTestLayer = (sqlLayer: Layer.Layer<SqlClient.SqlClient>) =>
  Layer.mergeAll(
    sqlLayer,
    QueryLoggerNoopLayer,
    makeRemoteConnectionLayer(RemoteConnectionId.make("123")),
  );
