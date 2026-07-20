import { rankItem, rankings } from "@tanstack/match-sorter-utils";

export type FilterOperator =
  | "eq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "in"
  | "not_eq"
  | "not_contains"
  | "between";

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string | number | (string | number)[];
  inverted?: boolean;
}

export interface ParsedNLQuery {
  success: boolean;
  filters?: FilterCondition[];
  orderBy?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  message?: string;
  rawInput?: string;
}

/**
 * Find the best matching column name for a given input string
 * Uses fuzzy matching to handle variations in spelling/spacing
 */
function findBestColumnMatch(input: string, availableColumns: string[]): string | null {
  if (!input || !availableColumns.length) return null;

  const normalized = input.toLowerCase().trim();

  // Exact match (case-insensitive)
  const exactMatch = availableColumns.find((col) => col.toLowerCase() === normalized);
  if (exactMatch) return exactMatch;

  // Fuzzy match - score each column
  const scored = availableColumns
    .map((col) => ({
      col,
      score: rankItem(col, input, { threshold: rankings.CONTAINS }),
    }))
    .filter((item) => item.score.passed)
    .toSorted((a, b) => b.score.rank - a.score.rank);

  return scored.length > 0 ? scored[0].col : null;
}

/**
 * Extract the operator from a filter expression
 */
function extractOperator(text: string): FilterOperator {
  const lower = text.toLowerCase();

  if (lower.includes("not") && lower.includes("equal")) return "not_eq";
  if (lower.includes("not") && lower.includes("contain")) return "not_contains";
  if (lower.includes("greater") || lower.includes("more") || />\s*=?/.test(text)) {
    return lower.includes("equal") || />=/.test(text) ? "gte" : "gt";
  }
  if (
    lower.includes("less") ||
    lower.includes("below") ||
    lower.includes("under") ||
    /<\s*=?/.test(text)
  ) {
    return lower.includes("equal") || /<=/.test(text) ? "lte" : "lt";
  }
  if (lower.includes("contain") || lower.includes("include") || lower.includes("like")) {
    return "contains";
  }
  if (lower.includes("in ") || lower.includes("one of")) {
    return "in";
  }

  return "eq";
}

/**
 * Extract numeric value from a string
 */
function extractNumericValue(str: string): number | null {
  const match = str.match(/-?\d+\.?\d*/);
  return match ? Number(match[0]) : null;
}

/**
 * Parse filters from natural language input
 * Supports patterns like:
 * - "age > 25"
 * - "name is john"
 * - "status = active"
 * - "NOT status = active" / "not age > 25" (inverted)
 * - "price between 10 and 100"
 * - "city in (new york, london, paris)"
 * - "NOT city in (…)" / "not price between 10 and 100"
 */
function parseFilters(input: string, availableColumns: string[]): FilterCondition[] {
  const filters: FilterCondition[] = [];

  // Pattern 0: leading NOT before a basic comparison — "NOT status = active"
  const notBasicPattern =
    /\bnot\s+(\w+(?:\s+\w+)*)\s+(?:is|equals?|=|>=|<=|>|<|greater\s+than|less\s+than|greater\s+than\s+or\s+equal|less\s+than\s+or\s+equal|contains|like|includes|not\s+equal|!=|<>|not\s+contains?)\s+['"]?([^,;'\n]+?)['"]?(?=\s+(?:and|or|,|\w+\s+(?:is|equals?|=|>|<)|not\s+\w)|$)/gi;

  let match;
  while ((match = notBasicPattern.exec(input)) !== null) {
    const columnName = match[1].trim();
    const valueStr = match[2].trim();
    const bestColumn = findBestColumnMatch(columnName, availableColumns);
    if (!bestColumn) continue;

    // Operator text excludes the leading "not " so extractOperator sees the real op
    const opText = match[0].replace(/^\s*not\s+/i, "");
    const operator = extractOperator(opText);
    let value: string | number;
    if (["gt", "lt", "gte", "lte"].includes(operator)) {
      const numValue = extractNumericValue(valueStr);
      value = numValue !== null ? numValue : valueStr;
    } else {
      value = valueStr;
    }

    filters.push({
      field: bestColumn,
      operator: operator === "not_eq" ? "eq" : operator === "not_contains" ? "contains" : operator,
      value,
      inverted: true,
    });
  }

  // Pattern 1: "column operator value" (e.g., "age > 25", "name is john")
  const basicPattern =
    /(\w+(?:\s+\w+)*)\s+(?:is|equals?|=|>=|<=|>|<|greater\s+than|less\s+than|greater\s+than\s+or\s+equal|less\s+than\s+or\s+equal|contains|like|includes|not\s+equal|!=|<>|not\s+contains?)\s+['"]?([^,;'\n]+?)['"]?(?=\s+(?:and|or|,|\w+\s+(?:is|equals?|=|>|<)|not\s+\w)|$)/gi;

  while ((match = basicPattern.exec(input)) !== null) {
    // Skip if this match sits inside a leading-NOT span already handled
    const matchStart = match.index ?? 0;
    const preceding = input.slice(Math.max(0, matchStart - 4), matchStart).toLowerCase();
    if (/\bnot\s*$/i.test(preceding) || preceding.endsWith("not ")) continue;

    const columnName = match[1].trim();
    const valueStr = match[2].trim();

    const bestColumn = findBestColumnMatch(columnName, availableColumns);
    if (!bestColumn) continue;

    // Avoid duplicating a filter already captured via NOT prefix
    const alreadyInverted = filters.some(
      (f) => f.field === bestColumn && f.inverted && String(f.value) === valueStr.trim(),
    );
    if (alreadyInverted) continue;

    const operator = extractOperator(match[0]);
    const isInverted =
      (operator === "contains" && match[0].toLowerCase().includes("not")) ||
      (operator === "not_eq" && match[0].toLowerCase().includes("not"));
    let value: string | number;

    // Try to parse as number if appropriate operator
    if (["gt", "lt", "gte", "lte"].includes(operator)) {
      const numValue = extractNumericValue(valueStr);
      value = numValue !== null ? numValue : valueStr;
    } else {
      value = valueStr;
    }

    filters.push({
      field: bestColumn,
      operator,
      value,
      ...(isInverted && { inverted: true }),
    });
  }

  // Pattern 2: "column between X and Y" / "NOT column between X and Y"
  const betweenPattern =
    /(\bnot\s+)?(\w+(?:\s+\w+)*)\s+between\s+(\d+\.?\d*)\s+and\s+(\d+\.?\d*)/gi;
  while ((match = betweenPattern.exec(input)) !== null) {
    const inverted = Boolean(match[1]);
    const columnName = match[2].trim();
    const bestColumn = findBestColumnMatch(columnName, availableColumns);
    if (bestColumn) {
      filters.push({
        field: bestColumn,
        operator: "between",
        value: [String(Number(match[3])), String(Number(match[4]))],
        ...(inverted && { inverted: true }),
      });
    }
  }

  // Pattern 3: "column in (…)" / "NOT column in (…)"
  const inPattern = /(\bnot\s+)?(\w+(?:\s+\w+)*)\s+in\s+\(([^)]+)\)/gi;
  while ((match = inPattern.exec(input)) !== null) {
    const inverted = Boolean(match[1]);
    const columnName = match[2].trim();
    const bestColumn = findBestColumnMatch(columnName, availableColumns);
    if (bestColumn) {
      const values = match[3]
        .split(",")
        .map((v) => v.trim().replace(/['"`]/g, ""))
        .filter((v) => v);

      filters.push({
        field: bestColumn,
        operator: "in",
        value: values,
        ...(inverted && { inverted: true }),
      });
    }
  }

  return filters;
}

/**
 * Parse sort/order by clause
 * Supports patterns like:
 * - "sort by age ascending"
 * - "order by name desc"
 * - "sorted by price"
 */
function parseOrderBy(
  input: string,
  availableColumns: string[],
): { field: string; direction: "asc" | "desc" } | null {
  // Match sort/order keywords, followed by optional "by", then capture the column name
  // The column name is captured more carefully to not include direction keywords
  const orderPattern =
    /(?:sort|order)(?:ed)?\s+(?:by)?\s+(\w+)(?:\s+(asc|ascending|desc|descending))?/i;
  const match = input.match(orderPattern);

  if (!match) return null;

  const columnName = match[1].trim();
  const bestColumn = findBestColumnMatch(columnName, availableColumns);

  if (!bestColumn) return null;

  // Check explicitly matched direction or fallback to searching input
  let direction: "asc" | "desc" = "asc";
  if (match[2]) {
    direction = match[2].toLowerCase().startsWith("desc") ? "desc" : "asc";
  } else {
    direction = input.toLowerCase().includes("desc") ? "desc" : "asc";
  }

  return {
    field: bestColumn,
    direction,
  };
}

/**
 * Parse limit clause
 * Supports patterns like:
 * - "top 10"
 * - "limit 50"
 * - "first 5 rows"
 */
function parseLimit(input: string): number | null {
  const limitPattern = /(?:top|limit|first)\s+(\d+)/i;
  const match = input.match(limitPattern);

  return match ? parseInt(match[1], 10) : null;
}

/**
 * Main natural language query parser
 * @param query - The natural language query string
 * @param availableColumns - List of available column names
 * @returns Parsed query structure
 */
export function parseNaturalLanguageQuery(
  query: string,
  availableColumns: string[],
): ParsedNLQuery {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return {
      success: false,
      message: "Query is empty",
      rawInput: query,
    };
  }

  if (!availableColumns.length) {
    return {
      success: false,
      message: "No columns available",
      rawInput: query,
    };
  }

  try {
    const filters = parseFilters(query, availableColumns);
    const orderBy = parseOrderBy(query, availableColumns);
    const limit = parseLimit(query);

    if (!filters.length && !orderBy && !limit) {
      // If nothing was parsed, that's still okay - might be just showing all data
      if (!normalizedQuery.length) {
        return {
          success: true,
          message: "No filters applied",
          rawInput: query,
        };
      }

      return {
        success: false,
        message: "Could not parse query",
        rawInput: query,
      };
    }

    return {
      success: true,
      filters: filters.length > 0 ? filters : undefined,
      orderBy: orderBy || undefined,
      limit: limit || undefined,
      rawInput: query,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to parse query: ${error instanceof Error ? error.message : "Unknown error"}`,
      rawInput: query,
    };
  }
}

/**
 * Get helpful hints/examples for the user
 */
export function getQueryExamples(columns: string[]): string[] {
  const examples: string[] = [];

  if (columns.length > 0) {
    const col1 = columns[0];
    examples.push(`Find ${col1} equals something`);
    examples.push(`Show where ${col1} contains text`);
  }

  if (columns.length > 1) {
    const col2 = columns[1];
    examples.push(`${columns[0]} greater than 100`);
    examples.push(`Sort by ${col2} ascending`);
  }

  examples.push("Top 10 results");
  examples.push("Limit 50");

  return examples;
}
