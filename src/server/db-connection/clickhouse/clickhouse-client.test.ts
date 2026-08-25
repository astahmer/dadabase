// @vitest-environment node
import type { Fragment } from "effect/unstable/sql/Statement";
import type { SqlClient as SqlClientInterface } from "effect/unstable/sql/SqlClient";

import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";
import * as StatementModule from "effect/unstable/sql/Statement";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  expandClickhouseParams,
  inferClickhouseParamType,
  layer as clickhouseLayer,
  makeClickhouseCompiler,
  mapEngineToTableKind,
  parseClickhouseEnumValues,
  parseClickhouseUrl,
  probeClickhouseUrl,
} from "./clickhouse-client.ts";

/**
 * Unit + contract tests for the ClickHouse SqlClient shim. The @clickhouse/client
 * transport is mocked (no docker / live server); the wire stub asserts that the
 * shim expands `{__dN}` markers into typed `{__dN:Type}` params and parses
 * JSONEachRow rows back into plain objects.
 */

const queryMock = vi.hoisted(() => vi.fn());
const commandMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@clickhouse/client", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const stubClient = (rows: Array<Record<string, unknown>>) => {
  queryMock.mockResolvedValue({ json: async () => rows });
  commandMock.mockResolvedValue({});
  createClientMock.mockReturnValue({ query: queryMock, command: commandMock });
};

const TestLayer = clickhouseLayer({
  url: "clickhouse://default:secret@ch.example.com:8123/analytics",
});

const run = <A, E>(program: Effect.Effect<A, E, SqlClientInterface>): Promise<A> =>
  Effect.runPromise(Effect.provide(program, TestLayer));

beforeEach(() => {
  queryMock.mockReset();
  commandMock.mockReset();
  createClientMock.mockReset();
});

describe("parseClickhouseUrl", () => {
  it("parses host/port/database/user/password with defaults", () => {
    const parts = parseClickhouseUrl("clickhouse://u:p@ch.example.com/analytics");
    expect(parts).toEqual({
      host: "ch.example.com",
      port: 8123,
      database: "analytics",
      username: "u",
      password: "p",
      secure: false,
    });
  });

  it("defaults the user to `default` and rejects foreign schemes", () => {
    expect(parseClickhouseUrl("clickhouse://ch.example.com").username).toBe("default");
    expect(() => parseClickhouseUrl("postgres://ch.example.com")).toThrow(/clickhouse:\/\//);
  });

  it("maps secure=true and sslmode=require to HTTPS", () => {
    expect(parseClickhouseUrl("clickhouse://h/db?secure=true").secure).toBe(true);
    expect(parseClickhouseUrl("clickhouse://h/db?sslmode=require").secure).toBe(true);
    expect(parseClickhouseUrl("clickhouse://h/db?sslmode=disable").secure).toBe(false);
  });

  it("strips dadabase_ marker params before parsing", () => {
    const parts = parseClickhouseUrl(
      "clickhouse://u:p@h:9440/db?dadabase_readonly=1&dadabase_ssh=abc",
    );
    expect(parts.port).toBe(9440);
  });
});

describe("inferClickhouseParamType", () => {
  it("infers conservative param types per value", () => {
    expect(inferClickhouseParamType("abc")).toBe("String");
    expect(inferClickhouseParamType(5)).toBe("Int64");
    expect(inferClickhouseParamType(1.5)).toBe("Float64");
    expect(inferClickhouseParamType(true)).toBe("Bool");
    expect(inferClickhouseParamType(undefined)).toBe("String");
  });
});

describe("expandClickhouseParams", () => {
  it("expands markers to typed named params", () => {
    const [sqlText, params] = expandClickhouseParams(
      "SELECT * FROM t WHERE a = {__1} AND b = {__2}",
      ["x", 7],
    );
    expect(sqlText).toBe("SELECT * FROM t WHERE a = {__1:String} AND b = {__2:Int64}");
    expect(params).toEqual({ __1: "x", __2: 7 });
  });

  it("inlines NULL and drops it from query_params", () => {
    const [sqlText, params] = expandClickhouseParams("UPDATE t SET a = {__1}", [null]);
    expect(sqlText).toBe("UPDATE t SET a = NULL");
    expect(params).toEqual({});
  });
});

describe("mapEngineToTableKind", () => {
  it("classifies engines honestly", () => {
    expect(mapEngineToTableKind("MergeTree")).toBe("table");
    expect(mapEngineToTableKind("ReplicatedMergeTree")).toBe("table");
    expect(mapEngineToTableKind("MaterializedView")).toBe("materialized-view");
    expect(mapEngineToTableKind("View")).toBe("view");
    expect(mapEngineToTableKind("LiveView")).toBe("view");
    expect(mapEngineToTableKind("Dictionary")).toBe("dictionary");
    expect(mapEngineToTableKind("File")).toBe("external");
  });
});

describe("parseClickhouseEnumValues", () => {
  it("extracts enum labels incl. escaped quotes", () => {
    expect(parseClickhouseEnumValues("Enum8('a' = 1, 'b' = 2)")).toEqual(["a", "b"]);
    expect(parseClickhouseEnumValues("Enum16('it\\'s' = 1)")).toEqual(["it's"]);
    expect(parseClickhouseEnumValues("Nullable(Enum8('x' = 0))")).toBeNull();
    expect(parseClickhouseEnumValues("String")).toBeNull();
  });
});

describe("makeClickhouseCompiler", () => {
  it("emits backtick identifiers and {__N} parameter markers", () => {
    const compiler = makeClickhouseCompiler();
    const statement = Statement_fragmentForCompileTest();
    const [sqlText] = compiler.compile(statement, false);
    expect(sqlText).toContain("`t`");
    expect(sqlText).toContain("{__1}");
    expect(sqlText).not.toContain("$1");
  });
});

describe("probeClickhouseUrl (mocked transport)", () => {
  it("returns success on SELECT 1", async () => {
    stubClient([]);
    const result = await Effect.runPromise(probeClickhouseUrl("clickhouse://h:8123/db"));
    expect(result.success).toBe(true);
  });

  it("surfaces transport failures as success:false", async () => {
    createClientMock.mockReturnValue({
      query: vi.fn().mockRejectedValue(new Error("Connection refused")),
    });
    const result = await Effect.runPromise(probeClickhouseUrl("clickhouse://h:8123/db"));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toContain("Connection refused");
  });
});

describe("clickhouse client over the mocked wire", () => {
  it("runs SELECT via query() with typed params and JSONEachRow rows", async () => {
    stubClient([{ n: "5", label: "eve" }]);
    const program = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      return yield* sql`SELECT count() AS n FROM \`t\` WHERE x > ${3}`;
    });
    const rows = (await run(program)) as Array<Record<string, unknown>>;
    // JSONEachRow quotes 64-bit integers by default (output_format_json_quote_
    // 64bit_integers), so `count()` arrives as "5". The shim deliberately does
    // NOT coerce numeric-looking strings — that would corrupt legitimate String
    // columns holding digits. Only real BigInt/Decimal values are normalized
    // (normalizeValue) with the same safe-range rule as the DuckDB shim.
    expect(rows[0]).toEqual({ n: "5", label: "eve" });

    const [call] = queryMock.mock.calls as Array<
      [{ query: string; format: string; query_params: Record<string, unknown> }]
    >;
    expect(call[0].format).toBe("JSONEachRow");
    expect(call[0].query).toContain("{__1:Int64}");
    expect(call[0].query_params).toEqual({ __1: 3 });
  });

  it("routes non-SELECT statements through command()", async () => {
    stubClient([]);
    const program = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      return yield* sql.unsafe("OPTIMIZE TABLE `t` FINAL");
    });
    await run(program as never);
    expect(commandMock).toHaveBeenCalledTimes(1);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

void Layer;
/** Helper kept next to its only consumer; isolates template-tag noise. */
function Statement_fragmentForCompileTest(): Fragment {
  return StatementModule.fragment([
    StatementModule.literal("SELECT * FROM "),
    StatementModule.identifier("t"),
    StatementModule.literal(" WHERE a = "),
    StatementModule.parameter(3),
  ]);
}
