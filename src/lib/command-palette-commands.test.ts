import { describe, expect, it } from "vitest";

import {
  buildCommandPaletteCommands,
  COMMAND_PALETTE_IDS,
  parseSwitchConnectionCommandId,
  parseSwitchSchemaCommandId,
  parseSwitchTableCommandId,
  switchConnectionCommandId,
  switchSchemaCommandId,
  switchTableCommandId,
} from "./command-palette-commands.ts";

describe("buildCommandPaletteCommands", () => {
  it("includes core static actions with ids, labels, and keywords", () => {
    const commands = buildCommandPaletteCommands();
    const byId = Object.fromEntries(commands.map((c) => [c.id, c]));

    expect(byId[COMMAND_PALETTE_IDS.openCustomSql]?.label).toMatch(/custom sql/i);
    expect(byId[COMMAND_PALETTE_IDS.openCustomSql]?.keywords).toContain("sql");

    expect(byId[COMMAND_PALETTE_IDS.toggleZen]?.label).toMatch(/zen/i);
    expect(byId[COMMAND_PALETTE_IDS.openAi]?.keywords).toContain("ai");
    expect(byId[COMMAND_PALETTE_IDS.openFavorites]?.keywords).toContain("favorites");
    expect(byId[COMMAND_PALETTE_IDS.openHistory]?.keywords).toContain("history");
    expect(byId[COMMAND_PALETTE_IDS.explain]?.keywords).toContain("explain");
    expect(byId[COMMAND_PALETTE_IDS.formatSql]?.keywords).toContain("format");
    expect(byId[COMMAND_PALETTE_IDS.showIndexes]?.keywords).toContain("indexes");
    expect(byId[COMMAND_PALETTE_IDS.showForeignKeys]?.keywords).toContain("fk");
    expect(byId[COMMAND_PALETTE_IDS.openSchemaExplorer]?.keywords).toContain("schema");
  });

  it("labels zen toggle based on current mode", () => {
    expect(
      buildCommandPaletteCommands({ zenMode: false }).find(
        (c) => c.id === COMMAND_PALETTE_IDS.toggleZen,
      )?.label,
    ).toMatch(/enter/i);
    expect(
      buildCommandPaletteCommands({ zenMode: true }).find(
        (c) => c.id === COMMAND_PALETTE_IDS.toggleZen,
      )?.label,
    ).toMatch(/exit/i);
  });

  it("adds switch-table commands and omits the current table", () => {
    const commands = buildCommandPaletteCommands({
      currentSchema: "public",
      currentTable: "users",
      tables: [
        { schema: "public", name: "users" },
        { schema: "public", name: "orders" },
        { schema: "auth", name: "sessions" },
      ],
    });

    const tableIds = commands.filter((c) => c.id.startsWith("switch-table:")).map((c) => c.id);
    expect(tableIds).toEqual([
      switchTableCommandId("public", "orders"),
      switchTableCommandId("auth", "sessions"),
    ]);
    expect(tableIds).not.toContain(switchTableCommandId("public", "users"));
  });

  it("adds switch-schema commands when schemas are available", () => {
    const commands = buildCommandPaletteCommands({
      currentSchema: "public",
      schemas: ["public", "auth", "billing"],
    });

    const schemaIds = commands.filter((c) => c.id.startsWith("switch-schema:")).map((c) => c.id);
    expect(schemaIds).toEqual([switchSchemaCommandId("auth"), switchSchemaCommandId("billing")]);
  });

  it("adds switch-connection commands when connections are available", () => {
    const commands = buildCommandPaletteCommands({
      currentConnectionName: "local",
      connections: [{ name: "local" }, { name: "staging" }],
    });

    const connectionIds = commands
      .filter((c) => c.id.startsWith("switch-connection:"))
      .map((c) => c.id);
    expect(connectionIds).toEqual([switchConnectionCommandId("staging")]);
  });

  it("assigns groups for filtering/display", () => {
    const commands = buildCommandPaletteCommands({
      tables: [{ schema: "public", name: "t" }],
      schemas: ["other"],
      connections: [{ name: "remote" }],
    });

    expect(commands.find((c) => c.id === COMMAND_PALETTE_IDS.openCustomSql)?.group).toBe("Actions");
    expect(commands.find((c) => c.id === COMMAND_PALETTE_IDS.explain)?.group).toBe("Query");
    expect(commands.find((c) => c.id.startsWith("switch-table:"))?.group).toBe("Tables");
    expect(commands.find((c) => c.id.startsWith("switch-schema:"))?.group).toBe("Schemas");
    expect(commands.find((c) => c.id.startsWith("switch-connection:"))?.group).toBe("Connections");
  });
});

describe("command id parsers", () => {
  it("round-trips switch-table ids", () => {
    const id = switchTableCommandId("public", "users");
    expect(parseSwitchTableCommandId(id)).toEqual({ schema: "public", table: "users" });
    expect(parseSwitchTableCommandId("nope")).toBeNull();
  });

  it("parses schema and connection ids", () => {
    expect(parseSwitchSchemaCommandId(switchSchemaCommandId("auth"))).toBe("auth");
    expect(parseSwitchSchemaCommandId("switch-schema:")).toBeNull();
    expect(parseSwitchConnectionCommandId(switchConnectionCommandId("prod"))).toBe("prod");
    expect(parseSwitchConnectionCommandId("switch-connection:")).toBeNull();
  });
});
