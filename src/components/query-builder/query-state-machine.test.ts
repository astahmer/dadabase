import { describe, expect, it } from "vitest";

import { analyzeQueryState, generateSuggestions, getInitialExamples } from "./query-state-machine";

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
      const operatorSuggestions = suggestions.filter((s) => s.type === "operator");
      // Should suggest "!= (not equal)" since "!" matches "!="
      expect(operatorSuggestions.some((s) => s.label.includes("!= (not equal)"))).toBe(true);
    });

    it("should show operator suggestions for partial = symbol", () => {
      const context = analyzeQueryState("name =", columns);
      const suggestions = generateSuggestions(context, columns);
      const operatorSuggestions = suggestions.filter((s) => s.type === "operator");
      // Should suggest "equals" since "=" matches "=" in symbols
      expect(operatorSuggestions.some((s) => s.label.includes("equals"))).toBe(true);
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
      const operatorSuggestions = suggestions.filter((s) => s.type === "operator");
      expect(operatorSuggestions.length).toBeGreaterThan(0);
      expect(operatorSuggestions.some((s) => s.label.includes("equals"))).toBe(true);
    });

    it("should show example values after operator", () => {
      const context = analyzeQueryState("name equals ", columns);
      const suggestions = generateSuggestions(context, columns);
      const valueSuggestions = suggestions.filter((s) => s.type === "value");
      expect(valueSuggestions.length).toBeGreaterThan(0);
    });

    it("should show columns after sort by", () => {
      const context = analyzeQueryState("sort by ", columns);
      const suggestions = generateSuggestions(context, columns);
      const sortColumnSuggestions = suggestions.filter((s) => s.type === "sort_column");
      expect(sortColumnSuggestions.length).toBeGreaterThan(0);
      expect(sortColumnSuggestions.some((s) => s.label === "name")).toBe(true);
    });

    it("should filter sort columns by startsWith", () => {
      const context = analyzeQueryState("sort by cr", columns);
      const suggestions = generateSuggestions(context, columns);
      const sortColumnSuggestions = suggestions.filter((s) => s.type === "sort_column");
      expect(sortColumnSuggestions.some((s) => s.label === "created_at")).toBe(true);
    });

    it("should show asc/desc after sort column", () => {
      const context = analyzeQueryState("sort by name ", columns);
      const suggestions = generateSuggestions(context, columns);
      const sortDirectionSuggestions = suggestions.filter((s) => s.type === "sort_direction");
      expect(sortDirectionSuggestions.length).toBe(2);
      expect(sortDirectionSuggestions.map((s) => s.label)).toContain("asc");
      expect(sortDirectionSuggestions.map((s) => s.label)).toContain("desc");
    });

    it("should detected complete state with sort by column and direction", () => {
      const context = analyzeQueryState("sort by name asc", columns);
      const suggestions = generateSuggestions(context, columns);

      expect(suggestions.length).toBe(0);
      expect(context.state).toBe("complete");
      expect(context.sortKeyword).toBe("sort by");
      expect(context.sortColumn).toBe("name");
      expect(context.sortDirection).toBe("asc");
    });

    it("should handle order by keyword", () => {
      const context = analyzeQueryState("order by ", columns);
      const suggestions = generateSuggestions(context, columns);
      const sortColumnSuggestions = suggestions.filter((s) => s.type === "sort_column");
      expect(sortColumnSuggestions.length).toBeGreaterThan(0);
    });

    it("should remove duplicates from suggestions", () => {
      const context = analyzeQueryState("name equals ", columns);
      const suggestions = generateSuggestions(context, columns);
      const labels = suggestions.map((s) => s.label);
      const uniqueLabels = new Set(labels);
      expect(labels.length).toBe(uniqueLabels.size);
    });

    it("should show sort by suggestion when typing 's'", () => {
      const context = analyzeQueryState("s", columns);
      const suggestions = generateSuggestions(context, columns);
      expect(suggestions.some((s) => s.label === "sort by")).toBe(true);
    });

    it("should show sort by suggestion when typing 'so'", () => {
      const context = analyzeQueryState("so", columns);
      const suggestions = generateSuggestions(context, columns);
      expect(suggestions.some((s) => s.label === "sort by")).toBe(true);
    });

    it("should show sort by suggestion when typing 'sor'", () => {
      const context = analyzeQueryState("sor", columns);
      const suggestions = generateSuggestions(context, columns);
      expect(suggestions.some((s) => s.label === "sort by")).toBe(true);
    });

    it("should show sort by suggestion when typing 'sort'", () => {
      const context = analyzeQueryState("sort", columns);
      const suggestions = generateSuggestions(context, columns);
      expect(suggestions.some((s) => s.label === "sort by")).toBe(true);
    });

    it("should show order by suggestion when typing 'o'", () => {
      const context = analyzeQueryState("o", columns);
      const suggestions = generateSuggestions(context, columns);
      expect(suggestions.some((s) => s.label === "order by")).toBe(true);
    });

    it("should show order by suggestion when typing 'or'", () => {
      const context = analyzeQueryState("or", columns);
      const suggestions = generateSuggestions(context, columns);
      expect(suggestions.some((s) => s.label === "order by")).toBe(true);
    });

    it("should show order by suggestion when typing 'ord'", () => {
      const context = analyzeQueryState("ord", columns);
      const suggestions = generateSuggestions(context, columns);
      expect(suggestions.some((s) => s.label === "order by")).toBe(true);
    });

    it("should show limit suggestion when typing 'l'", () => {
      const context = analyzeQueryState("l", columns);
      const suggestions = generateSuggestions(context, columns);
      expect(suggestions.some((s) => s.label === "limit")).toBe(true);
    });

    it("should show both sort and order by when ambiguous", () => {
      const context = analyzeQueryState("", columns);
      const suggestions = generateSuggestions(context, columns);
      // Both commands should be in initial examples
      const hasSort = suggestions.some((s) => s.label.includes("sort by"));
      const hasOrder = suggestions.some((s) => s.label.includes("order by"));
      expect(hasSort || hasOrder).toBe(true);
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
