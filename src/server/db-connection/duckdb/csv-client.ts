import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { Effect, Layer, Result, Semaphore } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as Client from "effect/unstable/sql/SqlClient";
import { randomBytes } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { SqlError } from "#src/db/effect-compat.ts";

import { makeDuckDbClientFromInstance } from "./duckdb-client.ts";

/**
 * CSV files as editable databases, riding on an in-memory DuckDB engine.
 *
 * A `csv` connection points at a single `.csv` file or a directory of `*.csv`
 * files. On first use each file is materialized into an in-memory DuckDB table
 * via `read_csv_auto` (full scan for accurate type inference), so paging,
 * filtering, introspection and row edits reuse the standard DuckDB code paths
 * (the shim compiles as dialect "pg"). Edits live in memory until an explicit
 * per-table Save exports the table back to its source file atomically
 * (tmp file → rename, previous file kept as `<name>.csv.bak`).
 *
 * Instances are cached by resolved path for the process lifetime (mirroring
 * duckdb-client.ts's instanceCache): staged-but-unsaved edits survive pool TTL
 * eviction and page reloads; they only die with the server process — which is
 * exactly why Save exists. See plans/csv-database-and-duckdb.md §B.
 */

const toSqlError = (cause: unknown, message: string) =>
  new SqlError({
    cause,
    ...(cause instanceof Error && cause.message ? { message: `${message}: ${cause.message}` } : {}),
  });

/** Size guardrails for full-scan materialization (§B.5). */
export const CSV_SIZE_LIMITS = {
  /** ≥ this total size → connect still works but warnings are surfaced. */
  warnBytes: 100 * 1024 * 1024,
  /** > this total size → connection is refused by default (RAM ≈ uncompressed size). */
  refuseBytes: 1024 * 1024 * 1024,
} as const;

export interface CsvTableEntry {
  /** Sanitized DuckDB table name derived from the filename stem. */
  readonly tableName: string;
  /** Original filename within the directory (or of the single file). */
  readonly fileName: string;
  /** Absolute path of the source csv file. */
  readonly filePath: string;
  readonly sizeBytes: number;
}

export class CsvConnectionError extends Error {}

/**
 * Table naming rule (§B.2): lowercase filename stem, characters outside
 * `[a-z0-9_]` collapsed to `_`, leading digit prefixed with `_`, empty → `_`.
 * Deterministic, so the save flow can map a table name back to its source file
 * by re-running the same function over the directory listing.
 */
export const csvTableName = (fileName: string): string => {
  const stem = fileName.replace(/\.[^./]*$/, "").toLowerCase();
  const sanitized = stem.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
  const trimmed = sanitized === "" ? "_" : sanitized;
  return /^[0-9]/.test(trimmed) ? `_${trimmed}` : trimmed;
};

export const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/** Pure size-guard decision so tests can exercise limits without real files. */
export const checkCsvSizeGuard = (
  totalBytes: number,
): { verdict: "ok" | "warn" | "refuse"; message?: string } => {
  if (totalBytes > CSV_SIZE_LIMITS.refuseBytes) {
    return {
      verdict: "refuse",
      message:
        `CSV data is ${formatBytes(totalBytes)}, above the 1 GB limit. ` +
        "Materializing it would consume roughly that much RAM in the embedded engine.",
    };
  }
  if (totalBytes >= CSV_SIZE_LIMITS.warnBytes) {
    return {
      verdict: "warn",
      message:
        `CSV data is ${formatBytes(totalBytes)} — initial load and inference may take a while. ` +
        "Consider splitting into smaller files.",
    };
  }
  return { verdict: "ok" };
};

/**
 * Resolve a csv connection target into its table entries. Single `.csv` file or
 * a directory containing `*.csv` files (flat listing, sorted). Throws
 * `CsvConnectionError` with a user-facing message when nothing usable is found.
 */
export const resolveCsvEntries = async (inputPath: string): Promise<CsvTableEntry[]> => {
  const absolute = path.resolve(inputPath);
  let info;
  try {
    info = await stat(absolute);
  } catch {
    throw new CsvConnectionError(`Path does not exist: ${absolute}`);
  }

  if (info.isFile()) {
    if (!absolute.toLowerCase().endsWith(".csv")) {
      throw new CsvConnectionError(`Not a CSV file: ${absolute} (expected a .csv extension)`);
    }
    return [
      {
        tableName: csvTableName(path.basename(absolute)),
        fileName: path.basename(absolute),
        filePath: absolute,
        sizeBytes: info.size,
      },
    ];
  }

  if (!info.isDirectory()) {
    throw new CsvConnectionError(`Path is neither a file nor a directory: ${absolute}`);
  }

  const names = (await readdir(absolute))
    .filter((n) => n.toLowerCase().endsWith(".csv"))
    .toSorted();
  if (names.length === 0) {
    throw new CsvConnectionError(`No .csv files found in directory: ${absolute}`);
  }

  const entries: CsvTableEntry[] = [];
  for (const name of names) {
    const filePath = path.join(absolute, name);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) continue;
    entries.push({
      tableName: csvTableName(name),
      fileName: name,
      filePath,
      sizeBytes: fileStat.size,
    });
  }
  return entries;
};

const quoteSqlString = (value: string): string => value.replaceAll("'", "''");

/** Fully-scans one csv file into a real table so edits have a stable target. */
const materializeCsvTable = (connection: DuckDBConnection, entry: CsvTableEntry) =>
  Effect.tryPromise({
    try: () =>
      // sample_size=-1: read every row so type inference is exact, not sampled.
      connection.run(
        `CREATE TABLE "${quoteSqlString(entry.tableName)}" AS ` +
          `SELECT * FROM read_csv_auto('${quoteSqlString(entry.filePath)}', header=true, sample_size=-1)`,
        [],
      ),
    catch: (cause) =>
      toSqlError(
        cause,
        `CsvClient: failed to load '${entry.fileName}' (as table '${entry.tableName}')`,
      ),
  });

/**
 * In-memory instances keyed by resolved csv connection path, alive for the
 * process lifetime. Deliberately NOT part of PoolCache's TTL cache: evicting
 * these would silently discard unsaved edits.
 */
const instanceRegistry = new Map<string, DuckDBInstance>();

/** Serializes registration + save flows per process (single embedded writer). */
const registrySemaphore = Semaphore.makeUnsafe(1);

const openAndRegister = (absolutePath: string): Promise<DuckDBInstance> =>
  (async () => {
    const entries = await resolveCsvEntries(absolutePath);

    const totalBytes = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
    const guard = checkCsvSizeGuard(totalBytes);
    if (guard.verdict === "refuse") throw new CsvConnectionError(guard.message ?? "CSV too large");

    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    try {
      for (const entry of entries) {
        await Effect.runPromise(materializeCsvTable(connection, entry));
      }
    } finally {
      connection.closeSync();
    }
    return instance;
  })();

/**
 * Get (or lazily create + materialize) the in-memory engine for a csv
 * connection path. Concurrent callers share one registration via semaphore.
 */
export const getOrCreateCsvInstance = (
  inputPath: string,
): Effect.Effect<DuckDBInstance, SqlError> =>
  Effect.suspend(() => {
    const absolutePath = path.resolve(inputPath);
    const cached = instanceRegistry.get(absolutePath);
    if (cached) return Effect.succeed(cached);
    return registrySemaphore.withPermit(
      Effect.tryPromise({
        try: async () => {
          // Re-check after acquiring the permit — another fiber may have won.
          const existing = instanceRegistry.get(absolutePath);
          if (existing) return existing;
          const instance = await openAndRegister(absolutePath);
          instanceRegistry.set(absolutePath, instance);
          return instance;
        },
        catch: (cause) =>
          toSqlError(
            cause,
            cause instanceof CsvConnectionError
              ? cause.message
              : `CsvClient: failed to load CSV database '${absolutePath}'`,
          ),
      }),
    );
  });

/** Test hook: drop the cached in-memory instance for a path (discards edits). */
export const resetCsvInstanceForTests = (inputPath: string): void => {
  const absolutePath = path.resolve(inputPath);
  const instance = instanceRegistry.get(absolutePath);
  if (instance) {
    try {
      instance.closeSync();
    } catch {
      // already closed
    }
    instanceRegistry.delete(absolutePath);
  }
};

/**
 * Probe a csv connection path without building a full client layer: validates
 * the path, applies size guards, materializes (which also warms the registry)
 * and runs a trivial query. Returns the detected tables so the connection form
 * can preview them (§B.4).
 */
export const probeCsvPath = (
  inputPath: string,
): Effect.Effect<
  | {
      success: true;
      message: string;
      tables: Array<{ tableName: string; fileName: string }>;
      warnings: string[];
    }
  | { success: false; message: string }
> =>
  Effect.gen(function* () {
    const absolutePath = path.resolve(inputPath);

    const entriesResult = yield* Effect.tryPromise({
      try: () => resolveCsvEntries(absolutePath),
      catch: () => new CsvConnectionError(`Cannot access path: ${absolutePath}`),
    }).pipe(Effect.result);
    if (Result.isFailure(entriesResult)) {
      return {
        success: false,
        message: entriesResult.failure.message,
      } as const;
    }
    const entries = entriesResult.success;

    const totalBytes = entries.reduce((sum: number, e) => sum + e.sizeBytes, 0);
    const guard = checkCsvSizeGuard(totalBytes);
    if (guard.verdict === "refuse") {
      return { success: false, message: guard.message ?? "CSV too large" } as const;
    }
    const warnings = guard.verdict === "warn" && guard.message ? [guard.message] : [];

    const instanceResult = yield* getOrCreateCsvInstance(absolutePath).pipe(Effect.result);
    if (Result.isFailure(instanceResult)) {
      return { success: false, message: extractMessage(instanceResult.failure) } as const;
    }

    return {
      success: true,
      message: `OK — ${entries.length} table${entries.length === 1 ? "" : "s"} detected`,
      tables: entries.map((e) => ({ tableName: e.tableName, fileName: e.fileName })),
      warnings,
    } as const;
  });

const extractMessage = (failure: unknown): string =>
  failure instanceof Error && failure.message ? failure.message : String(failure);

/**
 * SqlClient layer over the in-memory engine for a csv connection path.
 * The stored url uses SQLite/DuckDB's `file:<path>` convention; strip it here.
 */
export const layer = (csvUrl: string): Layer.Layer<Client.SqlClient, SqlError> =>
  getOrCreateCsvInstance(csvUrl.startsWith("file:") ? csvUrl.slice("file:".length) : csvUrl).pipe(
    Effect.flatMap((instance) =>
      makeDuckDbClientFromInstance(
        instance,
        csvUrl.startsWith("file:") ? csvUrl.slice("file:".length) : csvUrl,
      ),
    ),
    Layer.effect(Client.SqlClient),
    Layer.provide(Reactivity.layer),
  );

export interface SaveCsvTableResult {
  readonly tableName: string;
  readonly fileName: string;
  readonly rowsWritten: number;
  readonly backupPath: string | null;
}

/**
 * Export one edited in-memory table back to its source csv file (§B.3):
 *
 * 1. `COPY main."<table>" TO '<target>.tmp-<rand>' (FORMAT CSV, HEADER)`
 * 2. previous target file → `<target>.bak` (single rolling backup)
 * 3. tmp file renamed onto the target (atomic on same filesystem)
 */
export const saveCsvTable = (
  inputPath: string,
  tableName: string,
): Effect.Effect<SaveCsvTableResult, SqlError> =>
  Effect.gen(function* () {
    const absolutePath = path.resolve(inputPath);
    const instance = yield* getOrCreateCsvInstance(absolutePath);
    const connection = yield* Effect.tryPromise({
      try: () => instance.connect(),
      catch: (cause) => toSqlError(cause, "CsvClient: failed to open connection"),
    });

    return yield* registrySemaphore
      .withPermit(
        Effect.gen(function* () {
          const entries = yield* Effect.tryPromise({
            try: () => resolveCsvEntries(absolutePath),
            catch: (cause) => toSqlError(cause, extractMessage(cause)),
          });

          // Re-derive the source file mapping so renames on disk since connect
          // don't redirect writes to the wrong file.
          const entry = entries.find((e) => e.tableName === tableName);
          if (!entry) {
            return yield* Effect.fail(
              new SqlError({
                cause: null,
                message: `Table '${tableName}' not found among the CSV sources of ${absolutePath}`,
              }),
            );
          }

          const run = Effect.fnUntraced(function* (sqlText: string) {
            return yield* Effect.tryPromise({
              try: () => connection.run(sqlText, []),
              catch: (cause) =>
                toSqlError(cause, `CsvClient: query failed: ${sqlText.slice(0, 80)}`),
            });
          });

          const countResult = yield* run(
            `SELECT COUNT(*)::BIGINT AS n FROM "${quoteSqlString(tableName)}"`,
          );
          const rows = yield* Effect.tryPromise({
            try: async () => await countResult.getRowObjectsJS(),
            catch: (cause) => toSqlError(cause, "CsvClient: failed to read row count"),
          });
          const rowsWritten = Number((rows[0] as { n: unknown } | undefined)?.n ?? 0);

          const tmpPath = `${entry.filePath}.tmp-${randomBytes(6).toString("hex")}`;
          yield* run(
            `COPY "${quoteSqlString(tableName)}" TO '${quoteSqlString(tmpPath)}' (FORMAT CSV, HEADER)`,
          );

          const backupPath = `${entry.filePath}.bak`;
          const fsMod = yield* Effect.tryPromise({
            try: () => import("node:fs/promises"),
            catch: (cause) => toSqlError(cause, "CsvClient: failed to load fs module"),
          });

          yield* Effect.tryPromise({
            try: async () => {
              try {
                await fsMod.rename(entry.filePath, backupPath);
              } catch (error) {
                if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
              }
            },
            catch: (cause) => {
              // Roll forward cleanup: drop the tmp export so no litter remains.
              void fsMod.rm(tmpPath, { force: true }).catch(() => {});
              return toSqlError(cause, "CsvClient: failed to stage backup before swap");
            },
          });

          yield* Effect.tryPromise({
            try: () => fsMod.rename(tmpPath, entry.filePath),
            catch: (cause) =>
              toSqlError(cause, "CsvClient: failed to publish exported CSV (atomic rename)"),
          });

          return {
            tableName,
            fileName: entry.fileName,
            rowsWritten,
            // A `.bak` twin of the pre-save file (single rolling backup, §B.3).
            backupPath,
          } satisfies SaveCsvTableResult;
        }),
      )
      .pipe(
        Effect.ensuring(
          Effect.sync(() => {
            try {
              connection.closeSync();
            } catch {
              // already closed
            }
          }),
        ),
      );
  });
