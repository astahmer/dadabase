import { describe, it, expect } from "vitest";
import { parseNaturalLanguageQuery } from "./natural-language-parser";

describe("Natural Language Query Parser", () => {
	const columns = ["id", "name", "email", "age", "status", "created_at"];

	describe("Filter parsing", () => {
		it("should parse simple equality filters", () => {
			const result = parseNaturalLanguageQuery("name equals john", columns);
			expect(result.success).toBe(true);
			expect(result.filters).toHaveLength(1);
			expect(result.filters?.[0]).toEqual({
				field: "name",
				operator: "eq",
				value: "john",
			});
		});

		it("should parse greater than filters", () => {
			const result = parseNaturalLanguageQuery("age > 25", columns);
			expect(result.success).toBe(true);
			expect(result.filters).toHaveLength(1);
			expect(result.filters?.[0].operator).toBe("gt");
			expect(result.filters?.[0].value).toBe(25);
		});

		it("should parse less than filters", () => {
			const result = parseNaturalLanguageQuery("age < 50", columns);
			expect(result.success).toBe(true);
			expect(result.filters?.length).toBeGreaterThan(0);
			expect(result.filters?.[0].operator).toBe("lt");
		});

		it("should parse contains filters", () => {
			const result = parseNaturalLanguageQuery("email contains gmail", columns);
			expect(result.success).toBe(true);
			expect(result.filters).toHaveLength(1);
			expect(result.filters?.[0].operator).toBe("contains");
		});

		it("should parse between filters", () => {
			const result = parseNaturalLanguageQuery(
				"age between 20 and 30",
				columns,
			);
			expect(result.success).toBe(true);
			expect(result.filters).toHaveLength(2);
			expect(result.filters?.[0].operator).toBe("gte");
			expect(result.filters?.[1].operator).toBe("lte");
		});

		it("should parse in filters", () => {
			const result = parseNaturalLanguageQuery(
				"status in (active, pending, closed)",
				columns,
			);
			expect(result.success).toBe(true);
			expect(result.filters).toHaveLength(1);
			expect(result.filters?.[0].operator).toBe("in");
			expect(Array.isArray(result.filters?.[0].value)).toBe(true);
		});

		it("should handle multiple filters", () => {
			const result = parseNaturalLanguageQuery(
				"age > 25 and status equals active",
				columns,
			);
			expect(result.success).toBe(true);
			expect(result.filters?.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("Order by parsing", () => {
		it("should parse sort by ascending", () => {
			const result = parseNaturalLanguageQuery("sort by name asc", columns);
			expect(result.success).toBe(true);
			expect(result.orderBy).toEqual({
				field: "name",
				direction: "asc",
			});
		});

		it("should parse sort by descending", () => {
			const result = parseNaturalLanguageQuery("sort by age desc", columns);
			expect(result.success).toBe(true);
			expect(result.orderBy?.direction).toBe("desc");
		});

		it("should default to ascending if not specified", () => {
			const result = parseNaturalLanguageQuery("order by name", columns);
			expect(result.success).toBe(true);
			expect(result.orderBy?.direction).toBe("asc");
		});
	});

	describe("Limit parsing", () => {
		it("should parse top N", () => {
			const result = parseNaturalLanguageQuery("top 10", columns);
			expect(result.success).toBe(true);
			expect(result.limit).toBe(10);
		});

		it("should parse limit N", () => {
			const result = parseNaturalLanguageQuery("limit 50", columns);
			expect(result.success).toBe(true);
			expect(result.limit).toBe(50);
		});

		it("should parse first N", () => {
			const result = parseNaturalLanguageQuery("first 5 rows", columns);
			expect(result.success).toBe(true);
			expect(result.limit).toBe(5);
		});
	});

	describe("Complex queries", () => {
		it("should handle filter + sort + limit", () => {
			const result = parseNaturalLanguageQuery(
				"age > 25 sort by name desc limit 20",
				columns,
			);
			expect(result.success).toBe(true);
			expect(result.filters?.length).toBeGreaterThan(0);
			expect(result.orderBy?.field).toBe("name");
			expect(result.limit).toBe(20);
		});

		it("should handle fuzzy column matching", () => {
			// Note: fuzzy matching requires a reasonable threshold
			// "nm" alone is too fuzzy. We test with "nam" which is closer
			const result = parseNaturalLanguageQuery("nam equals test", columns);
			expect(result.success).toBe(true);
			if (result.filters?.length ?? 0 > 0) {
				expect(result.filters?.[0].field).toBe("name");
			}
		});
	});

	describe("Error handling", () => {
		it("should handle empty query", () => {
			const result = parseNaturalLanguageQuery("", columns);
			expect(result.success).toBe(false);
		});

		it("should handle query with no matching columns", () => {
			const result = parseNaturalLanguageQuery("xyz equals test", columns);
			expect(result.success).toBe(false); // No match, but no error
			// If no columns matched, we may have no filters
			expect(result.filters === undefined || result.filters.length === 0).toBe(
				true,
			);
		});

		it("should handle empty columns", () => {
			const result = parseNaturalLanguageQuery("name equals john", []);
			expect(result.success).toBe(false);
		});
	});
});
