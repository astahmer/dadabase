import { describe, expect, it } from "vitest";

import { UnsupportedSchemaMutateError } from "./build-alter-column-sql.ts";
import { buildAddForeignKeySql, buildDropForeignKeySql } from "./build-foreign-key-sql.ts";

describe("buildAddForeignKeySql", () => {
  it("builds an ADD CONSTRAINT FOREIGN KEY statement", () => {
    const sql = buildAddForeignKeySql({
      dialect: "postgres",
      schema: "public",
      table: "orders",
      constraintName: "fk_orders_customer",
      columns: ["customer_id"],
      referencedTable: "customers",
      referencedColumns: ["id"],
    });
    expect(sql).toBe(
      'ALTER TABLE "public"."orders"\n  ADD CONSTRAINT "fk_orders_customer"\n  FOREIGN KEY ("customer_id") REFERENCES "public"."customers" ("id");',
    );
  });

  it("qualifies the referenced table with a different schema", () => {
    const sql = buildAddForeignKeySql({
      dialect: "postgres",
      schema: "public",
      table: "orders",
      constraintName: "fk",
      columns: ["customer_id"],
      referencedSchema: "crm",
      referencedTable: "customers",
      referencedColumns: ["id"],
    });
    expect(sql).toContain('REFERENCES "crm"."customers"');
  });

  it("appends ON DELETE / ON UPDATE clauses", () => {
    const sql = buildAddForeignKeySql({
      dialect: "postgres",
      schema: "public",
      table: "orders",
      constraintName: "fk",
      columns: ["customer_id"],
      referencedTable: "customers",
      referencedColumns: ["id"],
      onDelete: "CASCADE",
      onUpdate: "RESTRICT",
    });
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).toContain("ON UPDATE RESTRICT");
  });

  it("supports composite foreign keys", () => {
    const sql = buildAddForeignKeySql({
      dialect: "postgres",
      schema: "public",
      table: "t",
      constraintName: "fk",
      columns: ["a", "b"],
      referencedTable: "ref",
      referencedColumns: ["x", "y"],
    });
    expect(sql).toContain('FOREIGN KEY ("a", "b") REFERENCES "public"."ref" ("x", "y")');
  });

  it("throws UnsupportedSchemaMutateError for sqlite", () => {
    expect(() =>
      buildAddForeignKeySql({
        dialect: "sqlite",
        schema: "main",
        table: "orders",
        constraintName: "fk",
        columns: ["customer_id"],
        referencedTable: "customers",
        referencedColumns: ["id"],
      }),
    ).toThrow(UnsupportedSchemaMutateError);
  });

  it("throws when constraint name is missing", () => {
    expect(() =>
      buildAddForeignKeySql({
        dialect: "postgres",
        schema: "public",
        table: "orders",
        constraintName: "",
        columns: ["customer_id"],
        referencedTable: "customers",
        referencedColumns: ["id"],
      }),
    ).toThrow("Constraint name is required");
  });
});

describe("buildDropForeignKeySql", () => {
  it("builds a DROP CONSTRAINT statement", () => {
    expect(
      buildDropForeignKeySql({
        dialect: "postgres",
        schema: "public",
        table: "orders",
        constraintName: "fk_orders_customer",
      }),
    ).toBe('ALTER TABLE "public"."orders"\n  DROP CONSTRAINT "fk_orders_customer";');
  });

  it("throws UnsupportedSchemaMutateError for sqlite", () => {
    expect(() =>
      buildDropForeignKeySql({
        dialect: "sqlite",
        schema: "main",
        table: "orders",
        constraintName: "fk",
      }),
    ).toThrow(UnsupportedSchemaMutateError);
  });
});
