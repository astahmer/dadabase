import { rankItem, rankings } from "@tanstack/match-sorter-utils";

export type QueryState = "empty" | "column" | "operator" | "value" | "complete";

export interface QueryToken {
	type: "column" | "operator" | "value";
	value: string;
}

export interface QueryContext {
	state: QueryState;
	tokens: QueryToken[];
	currentInput: string;
	column?: string;
	operator?: string;
	value?: string;
}

export interface Suggestion {
	label: string;
	value: string;
	type: "column" | "operator" | "value" | "example";
	state: QueryState;
}

// Available operators
export const OPERATORS = [
	{ label: "equals", symbols: ["=", "equals", "is"] },
	{ label: "contains", symbols: ["contains", "like", "includes"] },
	{ label: ">", symbols: [">", "greater than", "gt"] },
	{ label: ">=", symbols: [">=", "greater than or equal", "gte"] },
	{ label: "<", symbols: ["<", "less than", "lt"] },
	{ label: "<=", symbols: ["<=", "less than or equal", "lte"] },
	{ label: "!= (not equal)", symbols: ["!=", "<>", "not equal"] },
] as const;

export const OPERATOR_LABELS = OPERATORS.map((op) => op.label);

/**
 * Fuzzy match helper
 */
function fuzzyMatch(input: string, candidates: string[]): string[] {
	if (!input) return candidates;

	const scored = candidates
		.map((candidate) => ({
			candidate,
			score: rankItem(candidate, input, { threshold: rankings.CONTAINS }),
		}))
		.filter((item) => item.score.passed)
		.sort((a, b) => b.score.rank - a.score.rank)
		.map((item) => item.candidate);

	return scored;
}

/**
 * Analyze current query state based on input
 */
export function analyzeQueryState(
	input: string,
	_availableColumns: string[],
): QueryContext {
	const trimmed = input.trim();

	if (!trimmed) {
		return {
			state: "empty",
			tokens: [],
			currentInput: "",
		};
	}

	// Match operator pattern to identify what's been typed
	// Includes both word operators (equals, contains, etc.) and symbol operators (=, !=, >, >=, <, <=, <>)
	const operatorRegex =
		/\s+(equals?|contains?|like|includes|>|>=|<|<=|!=|<>|is)(?:\s+|$)/i;
	const match = operatorRegex.exec(trimmed);

	if (!match) {
		// Check if we have a symbol operator without space before it (e.g., "created_at=")
		const symbolOnlyRegex = /(\w+)(>=|<=|!=|<>|[=><])\s*(.*)$/;
		const symbolMatch = symbolOnlyRegex.exec(trimmed);

		if (symbolMatch) {
			const column = symbolMatch[1];
			const operator = symbolMatch[2];
			const afterOperator = symbolMatch[3];

			if (afterOperator.trim()) {
				return {
					state: "complete",
					tokens: [
						{ type: "column", value: column },
						{ type: "operator", value: operator },
						{ type: "value", value: afterOperator },
					],
					currentInput: afterOperator,
					column,
					operator,
					value: afterOperator,
				};
			}

			// Operator found but no value yet
			return {
				state: "operator",
				tokens: [
					{ type: "column", value: column },
					{ type: "operator", value: operator },
				],
				currentInput: "",
				column,
				operator,
			};
		}

		// No operator found yet - we're still in column state
		return {
			state: "column",
			tokens: [{ type: "column", value: trimmed }],
			currentInput: trimmed,
		};
	}

	// We found an operator
	const beforeOperator = trimmed.substring(0, match.index).trim();
	const operator = match[1].trim();
	const afterOperator = trimmed.substring(match.index + match[0].length).trim();

	const tokens: QueryToken[] = [
		{ type: "column", value: beforeOperator },
		{ type: "operator", value: operator },
	];

	if (afterOperator) {
		tokens.push({ type: "value", value: afterOperator });
		return {
			state: "complete",
			tokens,
			currentInput: afterOperator,
			column: beforeOperator,
			operator,
			value: afterOperator,
		};
	}

	// Operator found but no value yet
	return {
		state: "value",
		tokens,
		currentInput: "",
		column: beforeOperator,
		operator,
	};
}

/**
 * Generate suggestions based on query state
 */
export function generateSuggestions(
	context: QueryContext,
	availableColumns: string[],
): Suggestion[] {
	const suggestions: Suggestion[] = [];

	if (context.state === "empty") {
		// Show all available columns as column suggestions
		const matched = fuzzyMatch(context.currentInput, availableColumns);
		suggestions.push(
			...matched.map((col) => ({
				label: col,
				value: col + " ",
				type: "column" as const,
				state: "column" as const,
			})),
		);
	}

	if (context.state === "column") {
		// Filter columns based on what's been typed
		const matched = fuzzyMatch(context.currentInput, availableColumns);

		// Show matching columns
		suggestions.push(
			...matched.map((col) => ({
				label: col,
				value: col + " ",
				type: "column" as const,
				state: "column" as const,
			})),
		);

		// If there's a good match, also show operator suggestions
		const bestMatch = matched[0];
		if (bestMatch) {
			const columnSoFar = bestMatch;
			OPERATOR_LABELS.forEach((op) => {
				suggestions.push({
					label: `${columnSoFar} ${op}`,
					value: `${columnSoFar} ${op} `,
					type: "operator" as const,
					state: "operator" as const,
				});
			});
		}
	}

	if (context.state === "operator") {
		// Show value suggestions for the current operator
		if (context.column && context.operator) {
			const examples = generateExampleValues(context.column, context.operator);
			const matched = fuzzyMatch(context.currentInput, examples);

			suggestions.push(
				...matched.map((ex) => ({
					label: `${context.column} ${context.operator} ${ex}`,
					value: `${context.column} ${context.operator} ${ex}`,
					type: "value" as const,
					state: "value" as const,
				})),
			);

			// If no input yet, show all examples
			if (context.currentInput === "") {
				suggestions.push(
					...examples.map((ex) => ({
						label: `${context.column} ${context.operator} ${ex}`,
						value: `${context.column} ${context.operator} ${ex}`,
						type: "value" as const,
						state: "value" as const,
					})),
				);
			}
		}
	}

	if (context.state === "value" && context.column && context.operator) {
		// Show example values based on column and operator
		const examples = generateExampleValues(context.column, context.operator);
		const matched = fuzzyMatch(context.currentInput, examples);

		suggestions.push(
			...matched.map((ex) => ({
				label: `${context.column} ${context.operator} ${ex}`,
				value: `${context.column} ${context.operator} ${ex}`,
				type: "value" as const,
				state: "value" as const,
			})),
		);

		// Also show operators if nothing matched (in case user is refining)
		if (matched.length === 0 && context.currentInput === "") {
			// Show all example values when no input
			suggestions.push(
				...examples.map((ex) => ({
					label: `${context.column} ${context.operator} ${ex}`,
					value: `${context.column} ${context.operator} ${ex}`,
					type: "value" as const,
					state: "value" as const,
				})),
			);
		}
	}

	if (context.state === "complete") {
		// Show additional clauses (order by, limit)
		const additional = ["sort by", "order by", "limit", "top", "first"];
		const matched = fuzzyMatch(context.currentInput, additional);
		suggestions.push(
			...matched.map((clause) => ({
				label: `${clause}`,
				value: ` ${clause} `,
				type: "example" as const,
				state: "complete" as const,
			})),
		);
	}

	return suggestions;
}

/**
 * Generate example values for a column + operator combination
 */
function generateExampleValues(column: string, _operator: string): string[] {
	// Infer example values from column name
	const colLower = column.toLowerCase();

	// Common column patterns
	if (colLower.includes("count") || colLower.includes("quantity")) {
		return ["1", "5", "10", "50", "100"];
	}

	if (
		colLower.includes("price") ||
		colLower.includes("cost") ||
		colLower.includes("amount")
	) {
		return ["10.99", "50", "100", "500", "1000"];
	}

	if (colLower.includes("age")) {
		return ["18", "25", "30", "50"];
	}

	if (
		colLower.includes("date") ||
		colLower.includes("time") ||
		colLower.includes("created") ||
		colLower.includes("updated")
	) {
		return ["2024-01-01", "today", "2024", "recent"];
	}

	if (
		colLower.includes("name") ||
		colLower.includes("title") ||
		colLower.includes("label")
	) {
		return ["john", "alice", "example", "test"];
	}

	if (colLower.includes("status") || colLower.includes("state")) {
		return ["active", "inactive", "pending", "completed"];
	}

	if (colLower.includes("email")) {
		return ["user@example.com", "admin@example.com"];
	}

	if (colLower.includes("url") || colLower.includes("link")) {
		return ["https://example.com", "http://localhost"];
	}

	// Default examples
	return ["value", "example", "test", "sample"];
}

/**
 * Get example queries for initial state
 */
export function getInitialExamples(availableColumns: string[]): Suggestion[] {
	const suggestions: Suggestion[] = [];

	// Show first few columns as column examples
	availableColumns.slice(0, 3).forEach((col) => {
		suggestions.push({
			label: col,
			value: col + " ",
			type: "column",
			state: "column",
		});
	});

	// Show example complete queries
	if (availableColumns.length > 0) {
		const col1 = availableColumns[0];
		suggestions.push({
			label: `${col1} equals something`,
			value: `${col1} equals something`,
			type: "example",
			state: "complete",
		});

		suggestions.push({
			label: `${col1} contains text`,
			value: `${col1} contains text`,
			type: "example",
			state: "complete",
		});
	}

	if (availableColumns.length > 1) {
		const col2 = availableColumns[1];
		suggestions.push({
			label: `sort by ${col2} desc`,
			value: `sort by ${col2} desc`,
			type: "example",
			state: "complete",
		});
	}

	suggestions.push({
		label: "limit 10",
		value: "limit 10",
		type: "example",
		state: "complete",
	});

	return suggestions;
}
