import { Effect } from "effect";

import { DatabaseDialect } from "#src/db/dialect.ts";
import { stripDadabaseMarkerParams } from "#src/lib/connection-security.ts";
import { probeCsvPath } from "#src/server/db-connection/duckdb/csv-client.ts";
import { probeDuckDbPath } from "#src/server/db-connection/duckdb/duckdb-client.ts";

import { testLibsqlConnectionUrl } from "./test-libsql-connection.ts";
import { testMysqlConnectionUrl } from "./test-mysql-connection.ts";
import { testPgConnectionUrl } from "./test-pg-connection.ts";

export interface TryConnectionResult {
  readonly success: boolean;
  readonly message: string;
  /** CSV connections only (§B.4): detected table list for the form preview. */
  readonly tables?: ReadonlyArray<{ tableName: string; fileName: string }>;
  /** CSV connections only (§B.5): size-guardrail warnings. */
  readonly warnings?: ReadonlyArray<string>;
}

export const tryConnectionUrl = (input: {
  url: string;
  dialect: DatabaseDialect;
}): Effect.Effect<TryConnectionResult> =>
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
    if (input.dialect === DatabaseDialect.Csv) {
      // Same file-scheme convention as DuckDB; also returns detected tables for
      // the connection form preview (§B.4).
      return yield* probeCsvPath(url.startsWith("file:") ? url.slice("file:".length) : url);
    }

    return {
      success: false,
      message: "Unsupported database dialect",
    };
  });
