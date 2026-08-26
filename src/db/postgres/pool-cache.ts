import { LibsqlClient } from "@effect/sql-libsql";
import { MysqlClient } from "@effect/sql-mysql2";
import { PgClient } from "@effect/sql-pg";
import { Context, Deferred, Duration, Effect, Layer, Redacted, Ref, Schedule } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { SqlError } from "#src/db/effect-compat.ts";
import { parseSshTunnelFromUrl, stripDadabaseMarkerParams } from "#src/lib/connection-security.ts";
import { redactConnectionUrl } from "#src/lib/redact-connection-url.ts";
import { layerFromUrl as clickhouseLayerFromUrl } from "#src/server/db-connection/clickhouse/clickhouse-client.ts";
import { layer as csvDbLayer } from "#src/server/db-connection/duckdb/csv-client.ts";
import { layer as duckDbLayer } from "#src/server/db-connection/duckdb/duckdb-client.ts";
import { layerFromUrl as mssqlLayerFromUrl } from "#src/server/db-connection/mssql/mssql-client.ts";

import { DatabaseDialect } from "../dialect.ts";

export class PoolCache extends Context.Service<
  PoolCache,
  {
    readonly getOrCreate: (
      url: string,
      dialect: DatabaseDialect,
    ) => Effect.Effect<Layer.Layer<SqlClient.SqlClient, SqlError>, SqlError>;
    readonly getMetrics: () => Effect.Effect<{
      poolCount: number;
      urls: string[];
    }>;
  }
>()("@dadabase/PoolCache") {}

type CacheEntry = {
  layer: Layer.Layer<SqlClient.SqlClient, SqlError>;
  lastUsed: number;
  /** Closes the SSH local-forward for this pool, if one was opened. */
  closeTunnel?: () => void;
};

const POOL_TTL_MS = 5 * 60 * 1000; // 5 minutes

function defaultDbPort(dialect: DatabaseDialect): number {
  if (dialect === DatabaseDialect.MySQL) return 3306;
  if (dialect === DatabaseDialect.Mssql) return 1433;
  if (dialect === DatabaseDialect.Clickhouse) return 8123;
  return 5432;
}

function buildDriverLayer(
  driverUrl: string,
  dialect: DatabaseDialect,
): Layer.Layer<SqlClient.SqlClient, SqlError> {
  const connectTimeout = Duration.seconds(5);
  if (dialect === DatabaseDialect.Postgres) {
    return PgClient.layer({
      url: Redacted.make(driverUrl),
      maxConnections: 20,
      idleTimeout: Duration.seconds(30),
      connectTimeout,
    });
  }
  if (dialect === DatabaseDialect.MySQL) {
    return MysqlClient.layer({
      url: Redacted.make(driverUrl),
      maxConnections: 20,
      connectionTTL: Duration.seconds(30),
    }) as Layer.Layer<SqlClient.SqlClient, SqlError>;
  }
  if (dialect === DatabaseDialect.DuckDB) {
    // Stored like SQLite files as `file:<path>`; the driver wants the bare path.
    return duckDbLayer({
      url: driverUrl.startsWith("file:") ? driverUrl.slice("file:".length) : driverUrl,
    });
  }
  if (dialect === DatabaseDialect.Csv) {
    // Same file-scheme convention; the CSV engine owns its own in-memory
    // DuckDB instances keyed by path (see csv-client.ts).
    return csvDbLayer(driverUrl);
  }
  if (dialect === DatabaseDialect.Mssql) {
    return mssqlLayerFromUrl(driverUrl);
  }
  if (dialect === DatabaseDialect.Clickhouse) {
    return clickhouseLayerFromUrl(driverUrl);
  }
  return LibsqlClient.layer({ url: driverUrl });
}

/**
 * When SSH config is present on the URL, open a local forward and rewrite the
 * driver URL to `127.0.0.1:<ephemeralPort>`. Returns the (possibly rewritten)
 * driver URL and an optional close callback.
 *
 * SSH tunnel is dynamically imported only when `dadabase_ssh` is present so the
 * default pool/server-fn graph never pulls native `ssh2`/`cpu-features`.
 */
export async function resolveDriverUrlWithOptionalSsh(input: {
  url: string;
  dialect: DatabaseDialect;
  openTunnel?: (args: {
    config: NonNullable<ReturnType<typeof parseSshTunnelFromUrl>>;
    destinationHost: string;
    destinationPort: number;
  }) => Promise<{ localPort: number; close: () => void }>;
}): Promise<{ driverUrl: string; closeTunnel?: () => void }> {
  let driverUrl = stripDadabaseMarkerParams(input.url);
  const ssh = parseSshTunnelFromUrl(input.url);
  if (!ssh) return { driverUrl };

  const openTunnel =
    input.openTunnel ??
    (async (args) => {
      const { openSshLocalForward } = await import("#src/server/ssh-tunnel.ts");
      return openSshLocalForward(args);
    });

  const dest = new URL(driverUrl);
  const destinationHost = dest.hostname;
  const destinationPort = Number(dest.port) || defaultDbPort(input.dialect);
  const tunnel = await openTunnel({
    config: ssh,
    destinationHost,
    destinationPort,
  });
  dest.hostname = "127.0.0.1";
  dest.port = String(tunnel.localPort);
  return { driverUrl: dest.toString(), closeTunnel: tunnel.close };
}

export const makePoolCacheLive = Layer.effect(
  PoolCache,
  Effect.gen(function* () {
    const cacheRef = yield* Ref.make<Map<string, CacheEntry>>(new Map());
    /** In-flight pool creates — concurrent callers await the same Deferred. */
    const inflightRef = yield* Ref.make(
      new Map<string, Deferred.Deferred<Layer.Layer<SqlClient.SqlClient, SqlError>, SqlError>>(),
    );

    const cleanupRoutine = Effect.gen(function* () {
      yield* Ref.modify(cacheRef, (cache) => {
        const now = Date.now();
        const newCache = new Map(cache);

        for (const [url, entry] of newCache.entries()) {
          if (now - entry.lastUsed > POOL_TTL_MS) {
            try {
              entry.closeTunnel?.();
            } catch {
              // ignore tunnel close errors on eviction
            }
            newCache.delete(url);
          }
        }

        return [undefined, newCache];
      });
    }).pipe(Effect.repeat(Schedule.spaced("3 seconds")));

    yield* Effect.forkChild(cleanupRoutine);

    const createPool = (url: string, dialect: DatabaseDialect) =>
      Effect.gen(function* () {
        console.log(`[PoolCache] Creating new pool for ${redactConnectionUrl(url)}`);

        const { driverUrl, closeTunnel } = yield* Effect.tryPromise({
          try: () => resolveDriverUrlWithOptionalSsh({ url, dialect }),
          catch: (cause) =>
            new SqlError({
              cause,
              message: cause instanceof Error ? cause.message : String(cause),
            }),
        });

        const layer = buildDriverLayer(driverUrl, dialect);

        yield* Ref.update(cacheRef, (cache) => {
          const newCache = new Map(cache);
          newCache.set(url, { layer, lastUsed: Date.now(), closeTunnel });
          return newCache;
        });

        return layer;
      });

    return {
      getOrCreate: (url: string, dialect: DatabaseDialect) =>
        Effect.gen(function* () {
          const existing = (yield* Ref.get(cacheRef)).get(url);
          if (existing) {
            yield* Ref.update(cacheRef, (cache) =>
              new Map(cache).set(url, { ...existing, lastUsed: Date.now() }),
            );
            return existing.layer;
          }

          type PoolLayer = Layer.Layer<SqlClient.SqlClient, SqlError>;
          type PoolDeferred = Deferred.Deferred<PoolLayer, SqlError>;

          // Claim or join a single in-flight Deferred for this URL.
          const deferred = yield* Deferred.make<PoolLayer, SqlError>();
          const inflightDeferred = yield* Ref.modify(
            inflightRef,
            (inflight): [PoolDeferred, Map<string, PoolDeferred>] => {
              const pending = inflight.get(url);
              if (pending) return [pending, inflight];
              const next = new Map(inflight);
              next.set(url, deferred);
              return [deferred, next];
            },
          );

          if (inflightDeferred !== deferred) {
            return yield* Deferred.await(inflightDeferred);
          }

          // Re-check cache after claiming — another fiber may have finished.
          const raced = (yield* Ref.get(cacheRef)).get(url);
          if (raced) {
            yield* Deferred.succeed(deferred, raced.layer);
            yield* Ref.update(inflightRef, (m) => {
              const next = new Map(m);
              next.delete(url);
              return next;
            });
            return raced.layer;
          }

          return yield* createPool(url, dialect).pipe(
            Effect.tap((layer) => Deferred.succeed(deferred, layer)),
            Effect.tapError((err) => Deferred.fail(deferred, err)),
            Effect.ensuring(
              Ref.update(inflightRef, (m) => {
                const next = new Map(m);
                next.delete(url);
                return next;
              }),
            ),
          );
        }),

      getMetrics: () =>
        Ref.get(cacheRef).pipe(
          Effect.map((cache) => ({
            poolCount: cache.size,
            urls: Array.from(cache.keys()),
          })),
        ),
    };
  }),
);
