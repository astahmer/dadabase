import { Effect } from "effect";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { stripDadabaseMarkerParams } from "#src/lib/connection-security.ts";
import { probeDuckDbPath } from "#src/server/db-connection/duckdb/duckdb-client.ts";

import { testLibsqlConnectionUrl } from "./test-libsql-connection.ts";
import { testMysqlConnectionUrl } from "./test-mysql-connection.ts";
import { testPgConnectionUrl } from "./test-pg-connection.ts";

export const tryConnectionUrl = (input: { url: string; dialect: DatabaseDialect }) =>
  Effect.gen(function* () {
    const url = stripDadabaseMarkerParams(input.url);
    if (input.dialect === DatabaseDialect.Postgres) {
      return yield* testPgConnectionUrl(url);
    }
    if (input.dialect === DatabaseDialect.MySQL) {
      return yield* testMysqlConnectionUrl(url);
    }
    if (input.dialect === DatabaseDialect.SQLite || input.dialect === DatabaseDialect.LibSQL) {
      return yield* testLibsqlConnectionUrl(url);
    }
    if (input.dialect === DatabaseDialect.DuckDB) {
      // Stored like SQLite files: `file:<path>` — strip the scheme for the driver.
      const path = url.startsWith("file:") ? url.slice("file:".length) : url;
      return yield* probeDuckDbPath(path);
    }

    return {
      success: false,
      message: "Unsupported database dialect",
    };
  });
