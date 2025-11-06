import { describe, it, expect } from "vitest";
import {
	analyzeQueryState,
	generateSuggestions,
	getInitialExamples,
} from "./query-state-machine";

describe("query-state-machine", () => {
	const columns = ["id", "name", "email", "created_at", "age"];

	describe("analyzeQueryState", () => {
		it("should return empty state for empty input", () => {
			const result = analyzeQueryState("", columns);
			expect(result.state).toBe("empty");
			expect(result.tokens).toHaveLength(0);
		});

		it("should detect column state", () => {
			const result = analyzeQueryState("na", columns);
			expect(result.state).toBe("column");
			expect(result.currentInput).toBe("na");
		});

		it("should detect operator state after operator", () => {
			const result = analyzeQueryState("name equals ", columns);
			expect(result.state).toBe("operator");
			expect(result.column).toBe("name");
			expect(result.operator).toBe("equals");
		});

		it("should detect complete state with value", () => {
			const result = analyzeQueryState("name equals john", columns);
			expect(result.state).toBe("complete");
			expect(result.column).toBe("name");
			expect(result.operator).toBe("equals");
			expect(result.value).toBe("john");
		});

		it("should detect symbol operators with space", () => {
			const result = analyzeQueryState("created_at != 2024", columns);
			expect(result.state).toBe("complete");
			expect(result.column).toBe("created_at");
			expect(result.operator).toBe("!=");
			expect(result.value).toBe("2024");
		});

		it("should detect symbol operators without space", () => {
			const result = analyzeQueryState("created_at!=2024", columns);
			expect(result.state).toBe("complete");
			expect(result.column).toBe("created_at");
			expect(result.operator).toBe("!=");
			expect(result.value).toBe("2024");
		});

		it("should detect equals symbol operator", () => {
			const result = analyzeQueryState("name=john", columns);
			expect(result.state).toBe("complete");
			expect(result.column).toBe("name");
			expect(result.operator).toBe("=");
			expect(result.value).toBe("john");
		});

		it("should detect operator state after symbol operator", () => {
			const result = analyzeQueryState("age>=", columns);
			expect(result.state).toBe("operator");
			expect(result.column).toBe("age");
			expect(result.operator).toBe(">=");
		});

		it("should detect operator state with space before symbol operator", () => {
			const result = analyzeQueryState("created_at !", columns);
			expect(result.state).toBe("operator");
			expect(result.column).toBe("created_at");
			expect(result.operator).toBe("!");
		});

		it("should detect operator state with space before equals symbol", () => {
			const result = analyzeQueryState("name =", columns);
			expect(result.state).toBe("operator");
			expect(result.column).toBe("name");
			expect(result.operator).toBe("=");
		});

		it("should detect operator state with space before greater than symbol", () => {
			const result = analyzeQueryState("age >", columns);
			expect(result.state).toBe("operator");
			expect(result.column).toBe("age");
			expect(result.operator).toBe(">");
		});
	});

	describe("generateSuggestions - operator state with partial symbols", () => {
		it("should show operator suggestions for partial ! symbol", () => {
			const context = analyzeQueryState("created_at !", columns);
			const suggestions = generateSuggestions(context, columns);
			const operatorSuggestions = suggestions.filter(
				(s) => s.type === "operator",
			);
			// Should suggest "!= (not equal)" since "!" matches "!="
			expect(
				operatorSuggestions.some((s) => s.label.includes("!= (not equal)")),
			).toBe(true);
		});

		it("should show operator suggestions for partial = symbol", () => {
			const context = analyzeQueryState("name =", columns);
			const suggestions = generateSuggestions(context, columns);
			const operatorSuggestions = suggestions.filter(
				(s) => s.type === "operator",
			);
			// Should suggest "equals" since "=" matches "=" in symbols
			expect(operatorSuggestions.some((s) => s.label.includes("equals"))).toBe(
				true,
			);
		});

		it("should show value suggestions for complete operators", () => {
			const context = analyzeQueryState("name equals ", columns);
			const suggestions = generateSuggestions(context, columns);
			const valueSuggestions = suggestions.filter((s) => s.type === "value");
			// Should show example values, not operators
			expect(valueSuggestions.length).toBeGreaterThan(0);
		});
	});

	describe("generateSuggestions", () => {
		it("should show matching columns when empty", () => {
			const context = analyzeQueryState("", columns);
			const suggestions = generateSuggestions(context, columns);
			expect(suggestions.length).toBeGreaterThan(0);
			expect(suggestions.some((s) => s.type === "column")).toBe(true);
		});

		it("should filter columns by startsWith", () => {
			const context = analyzeQueryState("na", columns);
			const suggestions = generateSuggestions(context, columns);
			const columnSuggestions = suggestions.filter((s) => s.type === "column");
			expect(columnSuggestions.some((s) => s.label === "name")).toBe(true);
		});

		it("should show operators after column selected", () => {
			const context = analyzeQueryState("name ", columns);
			const suggestions = generateSuggestions(context, columns);
			const operatorSuggestions = suggestions.filter(
				(s) => s.type === "operator",
			);
			expect(operatorSuggestions.length).toBeGreaterThan(0);
			expect(operatorSuggestions.some((s) => s.label.includes("equals"))).toBe(
				true,
			);
		});

		it("should show example values after operator", () => {
			const context = analyzeQueryState("name equals ", columns);
			const suggestions = generateSuggestions(context, columns);
			const valueSuggestions = suggestions.filter((s) => s.type === "value");
			expect(valueSuggestions.length).toBeGreaterThan(0);
		});
	});

	describe("getInitialExamples", () => {
		it("should return initial example suggestions", () => {
			const suggestions = getInitialExamples(columns);
			expect(suggestions.length).toBeGreaterThan(0);
			// Should include at least one column, example, and limit
			expect(suggestions.some((s) => s.type === "column")).toBe(true);
			expect(suggestions.some((s) => s.type === "example")).toBe(true);
		});
	});
});
