import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";

import { describe, expect, it } from "vitest";

import { getTransitiveJoinRelationships } from "./get-transitive-join-relationships.ts";

const rel = (r: TableRelationship): TableRelationship => r;

describe("getTransitiveJoinRelationships", () => {
  it("expands join suggestions transitively as joins are added", () => {
    // Graph (direction shown as FK owner -> referenced):
    // A -> B
    // B -> F
    // F -> G
    // C -> G
    // G -> X/Y/Z
    const relationshipsBySource = new Map<string, TableRelationship[]>([
      [
        "public.A",
        [
          rel({
            type: "outgoing",
            referencingSchema: "public",
            referencingTable: "A",
            referencingColumn: "b_id",
            referencedSchema: "public",
            referencedTable: "B",
            referencedColumn: "id",
            constraintName: "fk_a_b",
          }),
        ],
      ],
      [
        "public.B",
        [
          rel({
            type: "outgoing",
            referencingSchema: "public",
            referencingTable: "B",
            referencingColumn: "f_id",
            referencedSchema: "public",
            referencedTable: "F",
            referencedColumn: "id",
            constraintName: "fk_b_f",
          }),
        ],
      ],
      [
        "public.F",
        [
          rel({
            type: "outgoing",
            referencingSchema: "public",
            referencingTable: "F",
            referencingColumn: "g_id",
            referencedSchema: "public",
            referencedTable: "G",
            referencedColumn: "id",
            constraintName: "fk_f_g",
          }),
        ],
      ],
      [
        "public.G",
        [
          rel({
            type: "outgoing",
            referencingSchema: "public",
            referencingTable: "G",
            referencingColumn: "x_id",
            referencedSchema: "public",
            referencedTable: "X",
            referencedColumn: "id",
            constraintName: "fk_g_x",
          }),
          rel({
            type: "outgoing",
            referencingSchema: "public",
            referencingTable: "G",
            referencingColumn: "y_id",
            referencedSchema: "public",
            referencedTable: "Y",
            referencedColumn: "id",
            constraintName: "fk_g_y",
          }),
          rel({
            type: "outgoing",
            referencingSchema: "public",
            referencingTable: "G",
            referencingColumn: "z_id",
            referencedSchema: "public",
            referencedTable: "Z",
            referencedColumn: "id",
            constraintName: "fk_g_z",
          }),
        ],
      ],
    ]);

    // Starting at A: only B is joinable
    {
      const suggestions = getTransitiveJoinRelationships({
        base: { schema: "public", table: "A" },
        joined: [],
        relationshipsBySource,
      });
      expect(
        suggestions.map((s) => `${s.relationship.type}:${s.relationship.constraintName}`),
      ).toEqual(["outgoing:fk_a_b"]);
    }

    // After joining B: F becomes joinable
    {
      const suggestions = getTransitiveJoinRelationships({
        base: { schema: "public", table: "A" },
        joined: [{ schema: "public", table: "B" }],
        relationshipsBySource,
      });
      expect(suggestions.map((s) => s.relationship.constraintName).toSorted()).toEqual(["fk_b_f"]);
    }

    // After joining B and F: G becomes joinable
    {
      const suggestions = getTransitiveJoinRelationships({
        base: { schema: "public", table: "A" },
        joined: [
          { schema: "public", table: "B" },
          { schema: "public", table: "F" },
        ],
        relationshipsBySource,
      });
      expect(suggestions.map((s) => s.relationship.constraintName)).toEqual(["fk_f_g"]);
    }

    // After joining B, F, and G: X/Y/Z become joinable
    {
      const suggestions = getTransitiveJoinRelationships({
        base: { schema: "public", table: "A" },
        joined: [
          { schema: "public", table: "B" },
          { schema: "public", table: "F" },
          { schema: "public", table: "G" },
        ],
        relationshipsBySource,
      });
      expect(suggestions.map((s) => s.relationship.constraintName).toSorted()).toEqual([
        "fk_g_x",
        "fk_g_y",
        "fk_g_z",
      ]);
    }
  });
});
