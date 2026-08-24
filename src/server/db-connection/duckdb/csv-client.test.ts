import type { SqlClient as SqlClientInterface } from "effect/unstable/sql/SqlClient";

import { Effect, Result } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  checkCsvSizeGuard,
  CSV_SIZE_LIMITS,
  csvTableName,
  layer,
  probeCsvPath,
  resolveCsvEntries,
  resetCsvInstanceForTests,
  saveCsvTable,
} from "./csv-client.ts";

/**
 * Colocated tests for CSV-as-database (plans/csv-database-and-duckdb.md §B).
 * The round-trip test is the acceptance core: load → edit cell → save →
 * reload shows the change and the persisted file stays valid CSV.
 */

const tempDirs: string[] = [];

const makeTempCsvDir = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "dadabase-csv-"));
  tempDirs.push(dir);
  return dir;
};

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

const runWithLayer = <A, E>(csvPath: string, program: Effect.Effect<A, E, SqlClientInterface>) =>
  Effect.runPromise(Effect.provide(program, layer(csvPath)));

describe("csvTableName", () => {
  it("sanitizes filename stems to [a-z0-9_]", () => {
    expect(csvTableName("People.csv")).toBe("people");
    expect(csvTableName("My Data-2024.CSV")).toBe("my_data_2024");
    expect(csvTableName("order details.csv")).toBe("order_details");
  });

  it("prefixes leading digits and collapses repeats", () => {
    expect(csvTableName("2024_sales.csv")).toBe("_2024_sales");
    expect(csvTableName("--weird---name.csv")).toBe("_weird_name");
  });
});

describe("checkCsvSizeGuard", () => {
  it("ok below warn threshold, warn at/above, refuse above hard limit", () => {
    expect(checkCsvSizeGuard(CSV_SIZE_LIMITS.warnBytes - 1).verdict).toBe("ok");
    expect(checkCsvSizeGuard(CSV_SIZE_LIMITS.warnBytes).verdict).toBe("warn");
    const refused = checkCsvSizeGuard(CSV_SIZE_LIMITS.refuseBytes + 1);
    expect(refused.verdict).toBe("refuse");
    expect(refused.message).toMatch(/1 GB/i);
  });
});

describe("resolveCsvEntries", () => {
  it("single file mode returns one entry named from the stem", async () => {
    const dir = makeTempCsvDir();
    const file = path.join(dir, "people.csv");
    writeFileSync(file, "id,name\n1,Alice\n");

    const entries = await resolveCsvEntries(file);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.tableName).toBe("people");
    expect(entries[0]?.filePath).toBe(file);
  });

  it("directory mode lists *.csv files sorted, ignoring others", async () => {
    const dir = makeTempCsvDir();
    writeFileSync(path.join(dir, "b_orders.csv"), "id\n1\n");
    writeFileSync(path.join(dir, "a_users.csv"), "id\n2\n");
    writeFileSync(path.join(dir, "notes.txt"), "ignore me\n");

    const entries = await resolveCsvEntries(dir);
    expect(entries.map((e) => e.tableName)).toEqual(["a_users", "b_orders"]);
  });

  it("throws a CsvConnectionError for missing paths and empty dirs", async () => {
    const dir = makeTempCsvDir();
    await expect(resolveCsvEntries(path.join(dir, "nope.csv"))).rejects.toThrow(/does not exist/i);
    await expect(resolveCsvEntries(dir)).rejects.toThrow(/no \.csv files/i);
  });
});

describe("probeCsvPath", () => {
  it("reports detected tables and warnings for large-ish data", async () => {
    const dir = makeTempCsvDir();
    writeFileSync(path.join(dir, "people.csv"), "id,name\n1,Alice\n");

    const probe = await Effect.runPromise(probeCsvPath(dir));
    if (!probe.success) throw new Error(probe.message);
    expect(probe.tables).toEqual([{ tableName: "people", fileName: "people.csv" }]);
    // Tiny fixture → no size warning.
    expect(probe.warnings).toEqual([]);
  });

  it("fails with the path error message", async () => {
    const probe = await Effect.runPromise(probeCsvPath("/definitely/not/here.csv"));
    expect(probe.success).toBe(false);
  });
});

describe("csv round-trip (load → edit → save → reload)", () => {
  it("persists edits atomically with a .bak backup and no tmp litter", async () => {
    const dir = makeTempCsvDir();

    // Fixture per §B.6: 10 rows, mixed types incl. NULLs.
    const rows = Array.from({ length: 10 }, (_, i) =>
      i === 3
        ? `${i + 1},nullable,,${(i + 1) * 1.5}`
        : `${i + 1},person_${i + 1},${i % 2 === 0},${(i + 1) * 1.5}`,
    );
    const peopleCsv = path.join(dir, "people.csv");
    writeFileSync(peopleCsv, `id,name,active,score\n${rows.join("\n")}\n`);

    // Load through the SqlClient layer — same surface any dialect uses.
    await runWithLayer(
      dir,
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        const count = yield* sql.unsafe('SELECT COUNT(*)::INT AS n FROM "people"');
        expect(count[0]).toEqual({ n: 10 });

        // Type inference came free via read_csv_auto.
        const columns = yield* sql.unsafe<{ column_name: string; data_type: string }>(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'people' ORDER BY ordinal_position
      `);
        expect(columns.map((c) => c.data_type)).toEqual(["BIGINT", "VARCHAR", "BOOLEAN", "DOUBLE"]);

        // Edit a cell in the materialized in-memory table.
        yield* sql.unsafe(`UPDATE "people" SET name = 'edited_row5' WHERE id = 5`);
        const edited = yield* sql.unsafe(`SELECT name FROM "people" WHERE id = 5`);
        expect(edited[0]).toEqual({ name: "edited_row5" });
      }),
    );

    // Explicit Save → atomic write-back.
    const saved = await Effect.runPromise(saveCsvTable(dir, "people"));
    expect(saved.fileName).toBe("people.csv");
    expect(saved.rowsWritten).toBe(10);

    const persisted = readFileSync(peopleCsv, "utf8");
    expect(persisted.split("\n")[0]).toBe("id,name,active,score");
    expect(persisted).toContain("edited_row5");
    expect(persisted).toContain("person_1");

    // Valid CSV round-trips through DuckDB again.
    const reparsed = await Effect.runPromise(probeCsvPath(dir));
    expect(reparsed.success).toBe(true);

    // Backup kept, tmp litter gone.
    expect(readFileSync(path.join(dir, "people.csv.bak"), "utf8")).not.toContain("edited_row5");
    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp-"));
    expect(leftovers).toEqual([]);
  }, 30_000);

  it("reload after reset reflects the saved edit (fresh materialization)", async () => {
    const dir = makeTempCsvDir();
    const file = path.join(dir, "items.csv");
    writeFileSync(file, "id,label\n1,alpha\n");

    await runWithLayer(
      dir,
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql.unsafe(`UPDATE "items" SET label = 'beta' WHERE id = 1`);
      }),
    );
    await Effect.runPromise(saveCsvTable(dir, "items"));

    // Simulate a fresh connection: drop the cached in-memory instance.
    resetCsvInstanceForTests(dir);

    await runWithLayer(
      dir,
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const reloaded = yield* sql.unsafe(`SELECT label FROM "items" WHERE id = 1`);
        expect(reloaded[0]).toEqual({ label: "beta" });
      }),
    );
  }, 30_000);

  it("save refuses unknown table names", async () => {
    const dir = makeTempCsvDir();
    writeFileSync(path.join(dir, "known.csv"), "a\n1\n");
    await runWithLayer(
      dir,
      Effect.gen(function* () {
        yield* SqlClient.SqlClient;
      }),
    );

    const failed = await Effect.runPromise(saveCsvTable(dir, "unknown_table").pipe(Effect.result));
    expect(Result.isFailure(failed)).toBe(true);
    if (Result.isFailure(failed) && failed.failure instanceof Error) {
      expect(failed.failure.message).toMatch(/not found/i);
    }
  }, 30_000);
});
