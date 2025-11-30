import { describe, expect, it } from "vitest";
import {
	filterQueryValidConditions,
	type QueryFilterType,
} from "./query-filter";

describe("filterQueryValidConditions", () => {
	it("should filter out conditions with empty column names", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "",
					operator: "equals",
					value: "test",
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).toBeNull();
	});

	it("should filter out conditions with undefined values for non-null operators", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "name",
					operator: "equals",
					value: undefined,
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).toBeNull();
	});

	it("should filter out conditions with null values for non-null operators", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "name",
					operator: "equals",
					value: null,
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).toBeNull();
	});

	it("should filter out conditions with empty string values", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "name",
					operator: "equals",
					value: "",
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).toBeNull();
	});

	it("should filter out conditions with empty array values for array operators", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "id",
					operator: "in",
					value: [],
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).toBeNull();
	});

	it("should preserve valid conditions with string values", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "name",
					operator: "equals",
					value: "Alice",
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).not.toBeNull();
		expect(result?.conditions).toHaveLength(1);
		expect(result?.conditions[0].value).toBe("Alice");
	});

	it("should preserve valid conditions with number values", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "age",
					operator: "greater_than",
					value: 25,
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).not.toBeNull();
		expect(result?.conditions).toHaveLength(1);
		expect(result?.conditions[0].value).toBe(25);
	});

	it("should preserve valid conditions with boolean values", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "published",
					operator: "equals",
					value: true,
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).not.toBeNull();
		expect(result?.conditions).toHaveLength(1);
		expect(result?.conditions[0].value).toBe(true);
	});

	it("should preserve is_null conditions without a value", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "deleted_at",
					operator: "is_null",
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).not.toBeNull();
		expect(result?.conditions).toHaveLength(1);
		expect(result?.conditions[0].operator).toBe("is_null");
	});

	it("should preserve is_not_null conditions without a value", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "deleted_at",
					operator: "is_not_null",
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).not.toBeNull();
		expect(result?.conditions).toHaveLength(1);
		expect(result?.conditions[0].operator).toBe("is_not_null");
	});

	it("should handle mixed valid and invalid conditions", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "name",
					operator: "equals",
					value: "Alice",
				},
				{
					column: "age",
					operator: "greater_than",
					value: undefined,
				},
				{
					column: "status",
					operator: "equals",
					value: "active",
				},
				{
					column: "deleted_at",
					operator: "is_null",
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).not.toBeNull();
		expect(result?.conditions).toHaveLength(3);
		expect(result?.conditions[0].column).toBe("name");
		expect(result?.conditions[1].column).toBe("status");
		expect(result?.conditions[2].column).toBe("deleted_at");
	});

	it("should preserve valid array values for array operators", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "id",
					operator: "in",
					value: ["1", "2", "3"],
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).not.toBeNull();
		expect(result?.conditions).toHaveLength(1);
		expect(result?.conditions[0].value).toEqual(["1", "2", "3"]);
	});

	it("should return null when all conditions are filtered out", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "",
					operator: "equals",
					value: undefined,
				},
				{
					column: "name",
					operator: "equals",
					value: null,
				},
				{
					column: "age",
					operator: "equals",
					value: "",
				},
			],
			logicalOperator: "and",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).toBeNull();
	});

	it("should preserve the logical operator", () => {
		const filter: QueryFilterType = {
			conditions: [
				{
					column: "name",
					operator: "equals",
					value: "Alice",
				},
				{
					column: "status",
					operator: "equals",
					value: "active",
				},
			],
			logicalOperator: "or",
		};

		const result = filterQueryValidConditions(filter);
		expect(result).not.toBeNull();
		expect(result?.logicalOperator).toBe("or");
	});
});
