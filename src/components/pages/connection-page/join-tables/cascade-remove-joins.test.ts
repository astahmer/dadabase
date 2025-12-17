import { describe, expect, it } from "vitest";
import type { JoinedTable } from "./join-tables.types";
import { cascadeRemoveJoins } from "./cascade-remove-joins.ts";

describe("cascadeRemoveJoins", () => {
	it("removes the target join and any joins anchored to it", () => {
		const joins: JoinedTable[] = [
			{
				schema: "public",
				table: "b",
				joinFrom: { schema: "public", table: "a" },
				type: "left",
				columns: "all",
				joinCondition: {
					mode: "standard",
					referencingColumn: "id",
					referencedColumn: "a_id",
				},
			},
			{
				schema: "public",
				table: "c",
				joinFrom: { schema: "public", table: "b" },
				type: "left",
				columns: "all",
				joinCondition: {
					mode: "standard",
					referencingColumn: "id",
					referencedColumn: "b_id",
				},
			},
			{
				schema: "public",
				table: "d",
				joinFrom: { schema: "public", table: "a" },
				type: "left",
				columns: "all",
				joinCondition: {
					mode: "standard",
					referencingColumn: "id",
					referencedColumn: "a_id",
				},
			},
		];

		const { joins: out, removedCount } = cascadeRemoveJoins({
			joins,
			remove: { schema: "public", table: "b" },
		});

		// Removes b and c (since c depends on b), but keeps d.
		expect(out.map((j) => j.table).sort()).toEqual(["d"]);
		expect(removedCount).toBe(2); // b and c
	});

	it("does not remove joins that are not transitively dependent", () => {
		const joins: JoinedTable[] = [
			{
				schema: "public",
				table: "b",
				joinFrom: { schema: "public", table: "a" },
				type: "left",
				columns: "all",
				joinCondition: {
					mode: "standard",
					referencingColumn: "id",
					referencedColumn: "a_id",
				},
			},
			{
				schema: "public",
				table: "x",
				joinFrom: { schema: "public", table: "a" },
				type: "left",
				columns: "all",
				joinCondition: {
					mode: "standard",
					referencingColumn: "id",
					referencedColumn: "a_id",
				},
			},
		];

		const { joins: out, removedCount } = cascadeRemoveJoins({
			joins,
			remove: { schema: "public", table: "b" },
		});
		expect(out.map((j) => j.table)).toEqual(["x"]);
		expect(removedCount).toBe(1); // just b
	});
});
