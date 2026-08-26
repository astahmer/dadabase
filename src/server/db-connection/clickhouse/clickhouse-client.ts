import type * as SqlConnection from "effect/unstable/sql/SqlConnection";

import { createClient, type ClickHouseClient, type ClickHouseSettings } from "@clickhouse/client";
import { Effect, Layer, Result, Stream } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as Client from "effect/unstable/sql/SqlClient";
import * as Statement from "effect/unstable/sql/Statement";

import { SqlError } from "#src/db/effect-compat.ts";

/**
 * ClickHouse driver for @effect/sql (v4).
 *
 * There is no official `@effect/sql` driver for ClickHouse, so this module builds
 * one from the public SPI on top of `@clickhouse/client` (pure-JS HTTP transport,
 * default port 8123). Structure mirrors the DuckDB shim (`duckdb-client.ts`).
 *
 * Divergences from the DuckDB shim:
 * - Own compiler (`dialect: "clickhouse"`): backtick identifiers and `{__dN:Type}`
 *   named bind parameters — ClickHouse has no positional `?`/`$n` support on most
 *   server versions still in production. Parameter types are inferred per value at
 *   execution time (see `inferClickhouseParamType`); NULLs are inlined because
 *   `{p:Nullable(Nothing)}` binding is unreliable across versions.
 * - Rows arrive as JSONEachRow objects; BigInt/Decimal normalization matches DuckDB.
 *
 * Mutation policy (documented decision): **read-only**. ClickHouse data changes run
 * through async `ALTER TABLE … UPDATE/DELETE` mutations that are non-transactional
 * and eventually consistent across replicas — a poor fit for a row-editor built on
 * synchronous UPDATE semantics. Row-mutation entry points fail fast here, and
 * `isReadOnlyConnection` reports `clickhouse:` URLs as read-only so every existing
 * UI guard (write toggle, schema-mutate sheet, custom-SQL gate) engages without new
 * frontend code.
 */

export interface ClickhouseUrlParts {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  /** HTTPS instead of HTTP. Rides `secure=true` or the shared `sslmode` convention. */
  readonly secure: boolean;
}

const DEFAULT_PORT = 8123;

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
 * Parse a persisted `clickhouse://user:pass@host[:port][/database][?secure|sslmode=…]`.
 * Throws on non-clickhouse schemes so mislabeled connections fail loudly at parse time.
 */
export const parseClickhouseUrl = (url: string): ClickhouseUrlParts => {
  const parsed = new URL(stripMarkerParams(url));
  if (parsed.protocol !== "clickhouse:") {
    throw new SqlError({
      cause: null,
      message: `ClickHouse URLs must use the clickhouse:// scheme (got '${parsed.protocol}')`,
    });
  }

  const sslMode = parsed.searchParams.get("sslmode");
  const explicitSecure = parsed.searchParams.get("secure");
  const secure =
    explicitSecure !== null
      ? explicitSecure === "true"
      : sslMode === "require" || sslMode === "verify-full";

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : DEFAULT_PORT,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    username: decodeURIComponent(parsed.username) || "default",
    password: decodeURIComponent(parsed.password),
    secure,
  };
};

/**
 * Infer the ClickHouse bind-parameter type for a JS value (`{name:Type}` syntax).
 * Numbers bind as Float64 — ClickHouse compares Int columns against Float64 params
 * without loss for safe integer ranges; strings stay String; bools are UInt8-backed
 * Bool. Dates bind as String ('YYYY-MM-DD HH:MM:SS' is implicitly castable).
 */
export const inferClickhouseParamType = (value: unknown): string => {
  switch (typeof value) {
    case "string":
      return "String";
    case "number":
      return Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER
        ? "Int64"
        : "Float64";
    case "bigint":
      return "Int64";
    case "boolean":
      return "Bool";
    default:
      return "String";
  }
};

/**
 * Expand the compiler's `{__dN}` markers into typed `{__dN:Type}` ClickHouse
 * parameters using the positional params array produced by `statement.compile()`.
 * NULL/undefined params are inlined as bare NULL (dropped from query_params) since
 * `{p:Nullable(Nothing)}` round-trips unreliably across server versions.
 * Returns `[sql, queryParams]`. Exported for tests.
 */
export const expandClickhouseParams = (
  sql: string,
  params: ReadonlyArray<unknown>,
): [string, Record<string, unknown>] => {
  const queryParams: Record<string, unknown> = {};
  const expanded = sql.replace(/\{__(\d+)\}/g, (_match, digits: string) => {
    const index = Number(digits) - 1;
    const value = index >= 0 && index < params.length ? params[index] : undefined;
    if (value === null || value === undefined) return "NULL";
    queryParams[`__${digits}`] = value;
    return `{__${digits}:${inferClickhouseParamType(value)}}`;
  });
  return [expanded, queryParams];
};

/**
 * Map a ClickHouse table engine to the app's table-kind vocabulary.
 * View-like engines are excluded from the base-table list by `getAvailableTables`;
 * this mapping exists so kind reporting stays honest about what an engine is.
 */
export const mapEngineToTableKind = (
  engine: string,
): "table" | "view" | "materialized-view" | "dictionary" | "external" => {
  const normalized = engine.trim().toLowerCase();
  if (normalized.includes("materializedview")) return "materialized-view";
  if (
    normalized === "view" ||
    normalized.includes("liveview") ||
    normalized.includes("windowview")
  ) {
    return "view";
  }
  if (normalized.includes("dictionary")) return "dictionary";
  if (
    normalized === "file" ||
    normalized === "url" ||
    normalized === "jdbc" ||
    normalized === "odbc"
  ) {
    return "external";
  }
  return "table";
};

/** Engines that must not appear in the base-table browser list. */
export const CLICKHOUSE_NON_TABLE_ENGINES = [
  "View",
  "MaterializedView",
  "LiveView",
  "WindowView",
  "Dictionary",
];

/**
 * Extract the value list from a ClickHouse Enum8/Enum16 column type
 * (`Enum8('a' = 1, 'b' = 2)` → `['a', 'b']`). Returns null for non-enum types or
 * unparseable definitions (reported as a plain string column instead).
 */
export const parseClickhouseEnumValues = (dataType: string): Array<string> | null => {
  const match = /^Enum(?:8|16)\((.*)\)$/i.exec(dataType.trim());
  if (!match) return null;
  const values: Array<string> = [];
  // Values are single-quoted with backslash escapes; split top-level commas only.
  const re = /'((?:[^'\\]|\\.)*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(match[1])) !== null) {
    values.push(m[1].replaceAll("\\'", "'").replaceAll("\\\\", "\\"));
  }
  return values.length > 0 ? values : null;
};

/**
 * ClickHouse returns BigInt for UInt64/Int64 columns and Decimal objects for
 * Decimal(p,s). Same JSON-safety rule as the DuckDB shim: safe ranges become
 * Numbers, everything else falls back to exact decimal strings.
 */
const normalizeValue = (value: unknown): unknown => {
  if (typeof value === "bigint") {
    return value >= -Number.MAX_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER
      ? Number(value)
      : value.toString();
  }
  if (value !== null && typeof value === "object") {
    // @clickhouse/client may surface Decimals as strings already; plain objects
    // (nested Array(T)/Map columns) recurse so inner bigints are normalized too.
    if (Array.isArray(value)) return value.map(normalizeValue);
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry)]),
    );
  }
  return value;
};

const normalizeRows = (
  rows: ReadonlyArray<Record<string, unknown>>,
): Array<Record<string, unknown>> =>
  rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])),
  );

type TransformRows = (<A extends object>(row: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined;
const applyTransform = (
  rows: ReadonlyArray<Record<string, unknown>>,
  transformRows: TransformRows,
): ReadonlyArray<Record<string, unknown>> =>
  transformRows
    ? rows.map((row) => transformRows([row as never])[0] as Record<string, unknown>)
    : rows;

interface QueryOutcome {
  readonly rows: Array<Record<string, unknown>>;
  /** Best-effort affected-row count from the X-ClickHouse-Summary header. */
  readonly rowCount: number;
}

/** Runs one statement over the wire; isolated so tests can stub it via vi.mock. */
const runOverWire = async (
  client: ClickHouseClient,
  expandedSql: string,
  queryParams: Record<string, unknown>,
): Promise<QueryOutcome> => {
  const isRead = /^\s*(select|with|show|exists|describe|desc)\b/i.test(expandedSql);
  if (isRead) {
    const result = await client.query({
      query: expandedSql,
      format: "JSONEachRow",
      query_params: queryParams,
      clickhouse_settings: {} satisfies ClickHouseSettings,
    });
    const rows = (await result.json<Record<string, unknown>>()) as Array<Record<string, unknown>>;
    return { rows: normalizeRows(rows), rowCount: rows.length };
  }

  await client.command({
    query: expandedSql,
    query_params: queryParams,
  });
  // command() responses carry no rowset; affected counts come from the summary
  // header, which is not exposed uniformly across client versions. Every mutating
  // path is blocked for ClickHouse anyway (read-only policy), so executeRaw's
  // rowCount only matters for SELECTs, which take the query() branch above.
  return { rows: [], rowCount: 0 };
};

const makeSqlConnection = (client: ClickHouseClient): SqlConnection.Connection => ({
  execute: (sql, params, transformRows) =>
    Effect.tryPromise({
      try: async () => {
        const [expanded, queryParams] = expandClickhouseParams(sql, params);
        const outcome = await runOverWire(client, expanded, queryParams);
        return applyTransform(outcome.rows, transformRows);
      },
      catch: (cause) => toSqlError(cause, "ClickHouseClient: query failed"),
    }),

  executeRaw: (sql, params) =>
    Effect.tryPromise({
      try: async () => {
        const [expanded, queryParams] = expandClickhouseParams(sql, params);
        const outcome = await runOverWire(client, expanded, queryParams);
        // Shape mirrors pg's QueryResult so extractRowsAffected keeps working.
        return { rowCount: outcome.rowCount, rows: outcome.rows };
      },
      catch: (cause) => toSqlError(cause, "ClickHouseClient: query failed"),
    }),

  executeValues: (sql, params) =>
    Effect.tryPromise({
      try: async () => {
        const [expanded, queryParams] = expandClickhouseParams(sql, params);
        const outcome = await runOverWire(client, expanded, queryParams);
        return outcome.rows.map((row) => Object.values(row).map(normalizeValue));
      },
      catch: (cause) => toSqlError(cause, "ClickHouseClient: query failed"),
    }),

  executeValuesUnprepared: (sql, params) =>
    Effect.tryPromise({
      try: async () => {
        const [expanded, queryParams] = expandClickhouseParams(sql, params);
        const outcome = await runOverWire(client, expanded, queryParams);
        return outcome.rows.map((row) => Object.values(row).map(normalizeValue));
      },
      catch: (cause) => toSqlError(cause, "ClickHouseClient: query failed"),
    }),

  executeUnprepared: (sql, params, transformRows) =>
    Effect.tryPromise({
      try: async () => {
        const [expanded, queryParams] = expandClickhouseParams(sql, params);
        const outcome = await runOverWire(client, expanded, queryParams);
        return applyTransform(outcome.rows, transformRows);
      },
      catch: (cause) => toSqlError(cause, "ClickHouseClient: query failed"),
    }),

  executeStream: (sql, params, transformRows) => {
    const stream = Stream.fromIterableEffect(
      Effect.tryPromise({
        try: async () => {
          const [expanded, queryParams] = expandClickhouseParams(sql, params);
          const outcome = await runOverWire(client, expanded, queryParams);
          return transformRows
            ? outcome.rows.map((row) => applyTransform([row], transformRows)[0])
            : outcome.rows;
        },
        catch: (cause) => toSqlError(cause, "ClickHouseClient: stream failed"),
      }),
    );
    return stream as unknown as Stream.Stream<any, SqlError>;
  },
});

/** Backtick identifier escaping (ClickHouse's canonical quoting). */
const escapeChIdentifier = Statement.defaultEscape("`");

/**
 * ClickHouse compiler: backtick identifiers + `{__dN}` parameter markers whose
 * types are inferred at expansion time (`expandClickhouseParams`). No insert/
 * record-update helpers — the app never uses them against remote connections.
 */
export const makeClickhouseCompiler = (): Statement.Compiler =>
  Statement.makeCompiler({
    dialect: "clickhouse",
    // Marker consumed by expandClickhouseParams; type suffix added per-value there.
    placeholder: (index) => `{__${index}}`,
    onIdentifier: escapeChIdentifier,
    onRecordUpdate: () => ["", []],
    onCustom: () => ["", []],
  });

/**
 * Clients are cached by resolved URL so repeated connections reuse the keep-alive
 * HTTP agent (driver-level counterpart of PoolCache / duckdb instanceCache).
 */
const clientCache = new Map<string, ClickHouseClient>();

const getOrCreateClient = (parts: ClickhouseUrlParts): ClickHouseClient => {
  const key = `${parts.secure ? "https" : "http"}://${parts.host}:${parts.port}/${parts.database}|${parts.username}`;
  const cached = clientCache.get(key);
  if (cached) return cached;
  const client = createClientFor(parts);
  clientCache.set(key, client);
  return client;
};

/** One-shot factory shared by the cache and the probe (probes never seed the cache). */
const createClientFor = (parts: ClickhouseUrlParts): ClickHouseClient =>
  createClient({
    host: `${parts.secure ? "https" : "http"}://${parts.host}:${parts.port}`,
    username: parts.username,
    password: parts.password,
    database: parts.database || undefined,
    request_timeout: 30_000,
    clickhouse_settings: {
      // Treat "double-quoted" strings as identifiers (ANSI mode) so every shared
      // pg-shaped introspection query/filter fragment resolves columns correctly;
      // without this, ClickHouse parses double quotes as string literals.
      enable_ansiquotes: 1,
      // Stabilizes part order for LIMIT/OFFSET pages that lack ORDER BY (the UI
      // always sends one when sorting is active; guidance documented otherwise).
      max_threads: 1,
    },
  });

/**
 * Probe a ClickHouse endpoint WITHOUT registering/seeding the long-lived client
 * cache: an unvalidated connection must never become the cached production
 * client, and a cached healthy client must not mask a transport outage.
 * Mirrors the `{ success, message }` shape of the other test-* connection probes.
 */
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

export const probeClickhouseUrl = (
  url: string,
): Effect.Effect<{ success: true; message: string } | { success: false; message: string }> =>
  Effect.gen(function* () {
    const config = yield* Effect.try({
      try: () => parseClickhouseUrl(url),
      catch: (cause) => toSqlError(cause, "ClickHouseClient: invalid connection URL"),
    }).pipe(Effect.result);

    if (Result.isFailure(config)) {
      return { success: false, message: extractFailureMessage(config.failure) } as const;
    }

    const probed = yield* Effect.tryPromise({
      try: async () => {
        const client = createClientFor(config.success);
        await client.query({ query: "SELECT 1", format: "JSONEachRow" });
        return true;
      },
      catch: (cause) => toSqlError(cause, "ClickHouseClient: probe query failed"),
    }).pipe(Effect.result);

    if (Result.isSuccess(probed)) {
      return { success: true, message: "OK" } as const;
    }
    return { success: false, message: extractFailureMessage(probed.failure) } as const;
  });

export interface MakeClickhouseClientOptions {
  readonly url: string;
}

export const makeClickhouseClient = Effect.fnUntraced(function* (
  options: MakeClickhouseClientOptions,
) {
  const parts = yield* Effect.try({
    try: () => parseClickhouseUrl(options.url),
    catch: (cause) => toSqlError(cause, "ClickHouseClient: invalid connection URL"),
  });
  const client = getOrCreateClient(parts);

  const sql = makeSqlConnection(client);
  const acquirer = Effect.succeed(sql);

  return yield* Client.make({
    acquirer,
    transactionAcquirer: acquirer,
    compiler: makeClickhouseCompiler(),
    spanAttributes: [
      ["db.system", "clickhouse"],
      [
        "db.url",
        `${parts.secure ? "https" : "http"}://${parts.host}:${parts.port}/${parts.database}`,
      ],
    ],
  });
});

export const layer = (
  config: MakeClickhouseClientOptions,
): Layer.Layer<Client.SqlClient, SqlError> =>
  makeClickhouseClient(config).pipe(
    Layer.effect(Client.SqlClient),
    Layer.provide(Reactivity.layer),
  );

/** Layer factory matching pool-cache's `layerFromUrl` convention. */
export const layerFromUrl = (url: string): Layer.Layer<Client.SqlClient, SqlError> =>
  layer({ url });
