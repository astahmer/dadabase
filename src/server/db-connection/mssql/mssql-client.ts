import { Effect, Layer, Redacted, Result } from "effect";
import type { SqlClient } from "effect/unstable/sql";
import { MssqlClient } from "@effect/sql-mssql";
import type { Connection as TediousConnection } from "tedious";

import { SqlError } from "#src/db/effect-compat.ts";

/**
 * Microsoft SQL Server driver integration.
 *
 * Unlike DuckDB (no official @effect/sql driver — we built a SqlConnection shim),
 * MSSQL ships an official `@effect/sql-mssql` client backed by `tedious`, so this
 * module only adapts the app's persisted `mssql://user:pass@host:port/db` URL
 * scheme into the structured `MssqlClientConfig` and provides the probe used by
 * the connection form ("Test connection").
 *
 * SSL mapping (rides the shared `sslmode` query param convention):
 * - `disable`     → encrypt=false
 * - `require`     → encrypt=true, trustServerCertificate=true (encrypted, but the
 *                   server certificate is not verified — the common self-hosted case)
 * - `verify-full` → encrypt=true, trustServerCertificate=false
 */

export interface MssqlUrlParts {
  readonly server: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly encrypt: boolean;
  readonly trustServerCertificate: boolean;
}

const DEFAULT_PORT = 1433;

const toSqlError = (cause: unknown, message: string) =>
  new SqlError({
    cause,
    ...(cause instanceof Error && cause.message ? { message: `${message}: ${cause.message}` } : {}),
  });

/** Strip dadabase-only marker params before parsing (same rule as pool-cache). */
function stripMarkerParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of parsed.searchParams.keys()) {
      if (key.startsWith("dadabase_")) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Parse a persisted `mssql://user:pass@host[:port][/database][?sslmode=…]` URL.
 * Throws on non-mssql schemes so mislabeled connections fail loudly at parse time.
 */
export const parseMssqlUrl = (url: string): MssqlUrlParts => {
  const parsed = new URL(stripMarkerParams(url));
  if (parsed.protocol !== "mssql:") {
    throw new SqlError({
      cause: null,
      message: `MSSQL URLs must use the mssql:// scheme (got '${parsed.protocol}')`,
    });
  }

  const sslMode = parsed.searchParams.get("sslmode");
  const explicitEncrypt = parsed.searchParams.get("encrypt");
  const explicitTrust = parsed.searchParams.get("trustServerCertificate");

  const encrypt = explicitEncrypt !== null ? explicitEncrypt === "true" : sslMode !== "disable";
  const trustServerCertificate =
    explicitTrust !== null ? explicitTrust === "true" : sslMode === "require";

  return {
    server: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : DEFAULT_PORT,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    encrypt,
    trustServerCertificate,
  };
};

/** Build the @effect/sql-mssql layer for a stored `mssql://…` connection URL. */
export const layerFromUrl = (url: string): Layer.Layer<SqlClient.SqlClient, SqlError> => {
  const parts = parseMssqlUrl(url);
  return MssqlClient.layer({
    server: parts.server,
    port: parts.port,
    database: parts.database || undefined,
    username: parts.username || undefined,
    password: parts.password ? Redacted.make(parts.password) : undefined,
    encrypt: parts.encrypt,
    trustServer: parts.trustServerCertificate,
    connectTimeout: 5_000,
    maxConnections: 20,
    connectionTTL: 30_000,
  }) as unknown as Layer.Layer<SqlClient.SqlClient, SqlError>;
};

function extractFailureMessage(failure: { readonly cause?: unknown }): string {
  const cause = failure.cause;
  if (
    cause &&
    typeof cause === "object" &&
    "message" in cause &&
    typeof cause.message === "string"
  ) {
    return cause.message;
  }
  if (failure instanceof Error && failure.message) return failure.message;
  return "Unknown connection error";
}

/**
 * Probe a SQL Server endpoint without registering a client layer.
 * Mirrors the `{ success, message }` shape of the other test-* connection probes.
 * SQL-auth only (tedious Windows/NTLM auth is out of scope); documented gap.
 */
export const probeMssqlUrl = (
  url: string,
): Effect.Effect<{ success: true; message: string } | { success: false; message: string }> =>
  Effect.gen(function* () {
    const config = yield* Effect.try({
      try: () => parseMssqlUrl(url),
      catch: (cause) => toSqlError(cause, "MssqlClient: invalid connection URL"),
    }).pipe(Effect.result);

    if (Result.isFailure(config)) {
      return { success: false, message: extractFailureMessage(config.failure) } as const;
    }
    if (!config.success.username || !config.success.password) {
      return {
        success: false,
        message: "MSSQL connections need SQL-auth user and password",
      } as const;
    }

    const probed = yield* Effect.tryPromise({
      try: async () => {
        const tedious = await import("tedious");
        const conn: TediousConnection = await new Promise((resolve, reject) => {
          const connection = new tedious.Connection({
            server: config.success.server,
            authentication: {
              type: "default",
              options: {
                userName: config.success.username,
                password: config.success.password,
              },
            },
            options: {
              port: config.success.port,
              database: config.success.database || undefined,
              encrypt: config.success.encrypt,
              trustServerCertificate: config.success.trustServerCertificate,
              connectTimeout: 5_000,
            },
          });
          const settle = (err?: unknown) => {
            connection.removeListener("connect", onConnect);
            connection.removeListener("error", onError);
            if (err) reject(err instanceof Error ? err : new Error(String(err)));
            else resolve(connection as TediousConnection);
          };
          const onConnect = () => settle();
          const onError = (err: Error) => settle(err);
          connection.on("connect", onConnect);
          connection.on("error", onError);
          connection.connect();
        });
        try {
          await new Promise<void>((resolve, reject) => {
            const request = new tedious.Request("SELECT 1", (err) => {
              if (err) reject(err);
              else resolve();
            });
            conn.execSql(request);
          });
        } finally {
          try {
            conn.close();
          } catch {
            // already closed
          }
        }
        return true;
      },
      catch: (cause) => toSqlError(cause, "MssqlClient: probe query failed"),
    }).pipe(Effect.result);

    if (Result.isSuccess(probed)) {
      return { success: true, message: "OK" } as const;
    }
    return { success: false, message: extractFailureMessage(probed.failure) } as const;
  });
