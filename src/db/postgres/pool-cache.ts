import { SqlError } from "@effect/sql/SqlError";

import { SqlClient } from "@effect/sql";
import { LibsqlClient } from "@effect/sql-libsql";
import { MysqlClient } from "@effect/sql-mysql2";
import { PgClient } from "@effect/sql-pg";
import { Context, Duration, Effect, Layer, Redacted, Ref, Schedule } from "effect";

import {
  parseSshTunnelFromUrl,
  stripDadabaseMarkerParams,
} from "#src/lib/connection-security.ts";
import { redactConnectionUrl } from "#src/lib/redact-connection-url.ts";
import { openSshLocalForward } from "#src/server/ssh-tunnel.ts";

import type { DatabaseDialect } from "../dialect.ts";

export class PoolCache extends Context.Tag("@dadabase/PoolCache")<
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
>() {}

type CacheEntry = {
  layer: Layer.Layer<SqlClient.SqlClient, SqlError>;
  lastUsed: number;
  /** Closes the SSH local-forward for this pool, if one was opened. */
  closeTunnel?: () => void;
};

const POOL_TTL_MS = 5 * 60 * 1000; // 5 minutes

function defaultDbPort(dialect: DatabaseDialect): number {
  if (dialect === "mysql") return 3306;
  return 5432;
}

function buildDriverLayer(
  driverUrl: string,
  dialect: DatabaseDialect,
): Layer.Layer<SqlClient.SqlClient, SqlError> {
  if (dialect === "postgres") {
    return PgClient.layer({
      url: Redacted.make(driverUrl),
      maxConnections: 20,
      idleTimeout: Duration.seconds(30),
    });
  }
  if (dialect === "mysql") {
    return MysqlClient.layer({
      url: Redacted.make(driverUrl),
      maxConnections: 20,
      connectionTTL: Duration.seconds(30),
    }) as Layer.Layer<SqlClient.SqlClient, SqlError>;
  }
  return LibsqlClient.layer({ url: driverUrl });
}

/**
 * When SSH config is present on the URL, open a local forward and rewrite the
 * driver URL to `127.0.0.1:<ephemeralPort>`. Returns the (possibly rewritten)
 * driver URL and an optional close callback.
 */
export async function resolveDriverUrlWithOptionalSsh(input: {
  url: string;
  dialect: DatabaseDialect;
  openTunnel?: typeof openSshLocalForward;
}): Promise<{ driverUrl: string; closeTunnel?: () => void }> {
  const openTunnel = input.openTunnel ?? openSshLocalForward;
  let driverUrl = stripDadabaseMarkerParams(input.url);
  const ssh = parseSshTunnelFromUrl(input.url);
  if (!ssh) return { driverUrl };

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

    // Spawn a single cleanup fiber that repeats every X seconds
    // This fiber is part of the layer's scope, so it lives for the entire app lifetime
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

    // Fork as daemon so it runs in background, managed by app scope
    yield* Effect.forkDaemon(cleanupRoutine);

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

          // Double-check after the (possibly slow) tunnel open to avoid duplicate pools.
          const winner = yield* Ref.modify(cacheRef, (cache) => {
            const raced = cache.get(url);
            if (raced) {
              try {
                closeTunnel?.();
              } catch {
                // ignore
              }
              return [
                raced.layer,
                new Map(cache).set(url, { ...raced, lastUsed: Date.now() }),
              ];
            }
            const newCache = new Map(cache);
            newCache.set(url, { layer, lastUsed: Date.now(), closeTunnel });
            return [layer, newCache];
          });

          return winner;
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
