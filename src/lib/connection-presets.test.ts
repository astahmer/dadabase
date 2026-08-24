import { describe, expect, it } from "vitest";

import { DatabaseDialect } from "#src/db/dialect.ts";

import {
  CONNECTION_PRESETS,
  getPresetById,
  getPresetDefaults,
  getPresetOptions,
} from "./connection-presets.ts";

describe("connection presets", () => {
  it("only rides existing dialect paths (postgres or mysql)", () => {
    for (const preset of CONNECTION_PRESETS) {
      expect(
        preset.dialect === DatabaseDialect.Postgres || preset.dialect === DatabaseDialect.MySQL,
        `${preset.id} must ride postgres/mysql, got ${preset.dialect}`,
      ).toBe(true);
    }
  });

  it("adds no new dialect enum values via preset ids", () => {
    const dialectValues = Object.values(DatabaseDialect);
    for (const preset of CONNECTION_PRESETS) {
      expect(dialectValues).toContain(preset.dialect);
    }
  });

  it("has unique ids and labels", () => {
    const ids = CONNECTION_PRESETS.map((p) => p.id);
    const labels = CONNECTION_PRESETS.map((p) => p.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("uses documented default ports", () => {
    const ports: Record<string, number> = {
      cockroachdb: 26257,
      neon: 5432,
      supabase: 5432,
      timescale: 5432,
      yugabyte: 5433,
      mariadb: 3306,
    };
    for (const [id, port] of Object.entries(ports)) {
      expect(getPresetDefaults(id as never)?.port).toBe(port);
    }
  });

  it("requires SSL for Neon and Supabase only", () => {
    for (const preset of CONNECTION_PRESETS) {
      if (preset.id === "neon" || preset.id === "supabase") {
        expect(preset.defaultSslMode).toBe("require");
      } else {
        expect(preset.defaultSslMode).toBeNull();
      }
    }
  });

  it("getPresetById returns undefined for unknown ids", () => {
    expect(getPresetById("does-not-exist" as never)).toBeUndefined();
    expect(getPresetDefaults("does-not-exist" as never)).toBeUndefined();
  });

  it("exposes select options in registry order with id values", () => {
    const options = getPresetOptions();
    expect(options.map((o) => o.value)).toEqual(CONNECTION_PRESETS.map((p) => p.id));
    expect(options.every((o) => o.label.length > 0)).toBe(true);
  });
});
