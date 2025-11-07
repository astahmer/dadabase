import { rankItem, rankings } from "@tanstack/match-sorter-utils";

export type QueryState =
	| "empty"
	| "column"
	| "operator"
	| "value"
	| "sort_column"
	| "sort_direction"
	| "complete";

export interface QueryToken {
	type:
		| "column"
		| "operator"
		| "value"
		| "sort_keyword"
		| "sort_column"
		| "sort_direction";
	value: string;
}

export interface QueryContext {
	state: QueryState;
	tokens: QueryToken[];
	currentInput: string;
	column?: string;
	operator?: string;
	value?: string;
	sortKeyword?: string; // "sort by" or "order by"
	sortColumn?: string;
	sortDirection?: string; // "asc" or "desc"
}

export interface Suggestion {
	label: string;
	value: string;
	type:
		| "column"
		| "operator"
		| "value"
		| "example"
		| "sort_column"
		| "sort_direction";
	state: QueryState;
	symbols?: string[]; // Optional symbols for operator suggestions
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
function matchFn(input: string, candidates: string[]): string[] {
	if (!input) return candidates;

	const scored = candidates
		.map((candidate) => ({
			candidate,
			score: rankItem(candidate, input, { threshold: rankings.STARTS_WITH }),
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
	availableColumns: string[],
): QueryContext {
	const trimmed = input.trim();

	if (!trimmed) {
		return {
			state: "empty",
			tokens: [],
			currentInput: "",
		};
	}

	// Check for partial sort/order by keywords (e.g., "s", "so", "sort", "sort" but NOT "sort by")
	// Only treat as partial if it doesn't contain a complete keyword
	const hasCompleteCommand = commands.some((cmd) =>
		trimmed.toLowerCase().includes(cmd),
	);

	if (!hasCompleteCommand) {
		// Check if user is typing a partial command keyword
		const isPartialCommand = commands.some((cmd) =>
			cmd.startsWith(trimmed.toLowerCase()),
		);
		if (isPartialCommand) {
			// User is typing a command keyword
			return {
				state: "empty",
				tokens: [],
				currentInput: trimmed,
			};
		}
	}

	// Check for sort by / order by clause first
	const sortMatch = parseSortClause(trimmed);
	if (sortMatch && sortMatch.keyword) {
		// We have a sort clause
		if (sortMatch.direction) {
			// Full sort clause: "sort by column asc"
			return {
				state: "complete",
				tokens: [
					{ type: "sort_keyword", value: sortMatch.keyword },
					{ type: "sort_column", value: sortMatch.column || "" },
					{ type: "sort_direction", value: sortMatch.direction },
				],
				currentInput: sortMatch.remaining || "",
				sortKeyword: sortMatch.keyword,
				sortColumn: sortMatch.column,
				sortDirection: sortMatch.direction,
			};
		} else if (sortMatch.column) {
			// Check if the column is a complete match or partial
			const isCompleteColumn = availableColumns.includes(sortMatch.column);

			if (isCompleteColumn) {
				// Sort clause with column but no direction: "sort by column"
				return {
					state: "sort_direction",
					tokens: [
						{ type: "sort_keyword", value: sortMatch.keyword },
						{ type: "sort_column", value: sortMatch.column },
					],
					currentInput: "",
					sortKeyword: sortMatch.keyword,
					sortColumn: sortMatch.column,
				};
			} else {
				// Partial column match: "sort by cr" (waiting for user to complete or select)
				return {
					state: "sort_column",
					tokens: [{ type: "sort_keyword", value: sortMatch.keyword }],
					currentInput: sortMatch.column,
					sortKeyword: sortMatch.keyword,
				};
			}
		} else {
			// Sort clause keyword only: "sort by"
			return {
				state: "sort_column",
				tokens: [{ type: "sort_keyword", value: sortMatch.keyword }],
				currentInput: "",
				sortKeyword: sortMatch.keyword,
			};
		}
	}

	// Match operator pattern to identify what's been typed
	// Includes both word operators (equals, contains, etc.) and symbol operators (=, !=, >, >=, <, <=, <>)
	const operatorRegex =
		/\s+(equals?|contains?|like|includes|>|>=|<|<=|!=|<>|is)(?:\s+|$)/i;
	const match = operatorRegex.exec(trimmed);

	if (!match) {
		// Check if we have a symbol operator with space before it (e.g., "created_at !" or "created_at =")
		const symbolWithSpaceRegex = /^(\w+)\s+([!<>=]+)(\s*)(.*)$/;
		const symbolWithSpaceMatch = symbolWithSpaceRegex.exec(trimmed);

		if (symbolWithSpaceMatch) {
			const column = symbolWithSpaceMatch[1];
			const partialOperator = symbolWithSpaceMatch[2];
			const afterOperator = symbolWithSpaceMatch[4];

			// If there's content after operator, it's complete
			if (afterOperator.trim()) {
				return {
					state: "complete",
					tokens: [
						{ type: "column", value: column },
						{ type: "operator", value: partialOperator },
						{ type: "value", value: afterOperator },
					],
					currentInput: afterOperator,
					column,
					operator: partialOperator,
					value: afterOperator,
				};
			}

			// Operator found but no value yet - we're in "operator" state
			// This handles cases like "created_at !" where the user might want "!="
			return {
				state: "operator",
				tokens: [
					{ type: "column", value: column },
					{ type: "operator", value: partialOperator },
				],
				currentInput: "",
				column,
				operator: partialOperator,
			};
		}

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

	// Operator found but no value yet - return "operator" state
	return {
		state: "operator",
		tokens,
		currentInput: "",
		column: beforeOperator,
		operator,
	};
}

// Check for sort by / order by clause at any point
function parseSortClause(input: string): {
	keyword?: string;
	column?: string;
	direction?: string;
	remaining?: string;
} | null {
	const sortRegex =
		/\b(sort\s+by|order\s+by)(?:\s+(\w+))?(?:\s+(asc|desc))?(?:\s+(.*))?$/i;
	const match = sortRegex.exec(input);

	if (!match) return null;

	const keyword = match[1];
	const column = match[2];
	const direction = match[3];
	const remaining = match[4];

	return { keyword, column, direction, remaining };
}

const commands = ["sort by", "order by", "limit", "top", "first"];

/**
 * Generate suggestions based on query state
 */
export function generateSuggestions(
	context: QueryContext,
	availableColumns: string[],
): Suggestion[] {
	const suggestions: Suggestion[] = [];
	const seen = new Set<string>();

	const addSuggestion = (suggestion: Suggestion) => {
		const key = `${suggestion.type}:${suggestion.value}`;
		if (!seen.has(key)) {
			seen.add(key);
			suggestions.push(suggestion);
		}
	};

	if (context.state === "empty") {
		// Show commands (sort by, order by, limit, top, first)
		const matchedCommands = matchFn(context.currentInput, commands);
		matchedCommands.forEach((cmd) => {
			addSuggestion({
				label: cmd,
				value: cmd + " ",
				type: "example",
				state: "empty",
			});
		});

		// Show all available columns as column suggestions
		const matched = matchFn(context.currentInput, availableColumns);
		matched.forEach((col) => {
			addSuggestion({
				label: col,
				value: col + " ",
				type: "column",
				state: "column",
			});
		});
	}

	if (context.state === "column") {
		// Filter columns based on what's been typed
		const matched = matchFn(context.currentInput, availableColumns);

		// Check if we have an exact column match
		const exactMatch = matched.find((col) => col === context.currentInput);

		if (exactMatch) {
			// User has finished typing a column name - show only operator suggestions
			OPERATOR_LABELS.forEach((op) => {
				const operatorDef = OPERATORS.find((o) => o.label === op);
				const symbols = operatorDef ? operatorDef.symbols.slice(0, 2) : []; // Get first 2 symbols
				addSuggestion({
					label: `${exactMatch} ${op}`,
					value: `${exactMatch} ${op} `,
					type: "operator",
					state: "operator",
					symbols: symbols as string[],
				});
			});
		} else if (matched.length > 0) {
			// User is still typing a column name - show column completions
			matched.forEach((col) => {
				addSuggestion({
					label: col,
					value: col + " ",
					type: "column",
					state: "column",
				});
			});
		}
	}

	if (context.state === "operator") {
		// Show value suggestions for the current operator
		if (context.column && context.operator) {
			// Check if operator is a symbol operator (including single symbols like "!", "=", "<", ">")
			const isSymbolOperator = /^[!<>=]+$/.test(context.operator);

			if (isSymbolOperator) {
				// Show complete operators that match the symbol(s)
				const operatorLower = context.operator.toLowerCase();
				const matchingOperators = OPERATOR_LABELS.filter((op) => {
					// Get all symbols for this operator
					const operatorDef = OPERATORS.find((o) => o.label === op);
					if (!operatorDef) return false;
					// Check if any symbol matches exactly or could be extended (partial match)
					return operatorDef.symbols.some(
						(sym) => sym === operatorLower || sym.startsWith(operatorLower),
					);
				});

				// Remove duplicates and show all matching operators
				const uniqueMatches = Array.from(new Set(matchingOperators));
				uniqueMatches.forEach((op) => {
					const operatorDef = OPERATORS.find((o) => o.label === op);
					const symbols = operatorDef ? operatorDef.symbols.slice(0, 2) : [];
					addSuggestion({
						label: `${context.column} ${op}`,
						value: `${context.column} ${op} `,
						type: "operator",
						state: "operator",
						symbols: symbols as string[],
					});
				});
			} else {
				// Full operator, show value examples
				const examples = generateExampleValues(
					context.column,
					context.operator,
				);
				const matched = matchFn(context.currentInput, examples);

				matched.forEach((ex) => {
					addSuggestion({
						label: `${context.column} ${context.operator} ${ex}`,
						value: `${context.column} ${context.operator} ${ex}`,
						type: "value",
						state: "value",
					});
				});

				// If no input yet, show all examples
				if (context.currentInput === "") {
					examples.forEach((ex) => {
						addSuggestion({
							label: `${context.column} ${context.operator} ${ex}`,
							value: `${context.column} ${context.operator} ${ex}`,
							type: "value",
							state: "value",
						});
					});
				}
			}
		}
	}

	if (context.state === "value" && context.column && context.operator) {
		// Show example values based on column and operator
		const examples = generateExampleValues(context.column, context.operator);
		const matched = matchFn(context.currentInput, examples);

		matched.forEach((ex) => {
			addSuggestion({
				label: `${context.column} ${context.operator} ${ex}`,
				value: `${context.column} ${context.operator} ${ex}`,
				type: "value",
				state: "value",
			});
		});

		// Also show operators if nothing matched (in case user is refining)
		if (matched.length === 0 && context.currentInput === "") {
			// Show all example values when no input
			examples.forEach((ex) => {
				addSuggestion({
					label: `${context.column} ${context.operator} ${ex}`,
					value: `${context.column} ${context.operator} ${ex}`,
					type: "value",
					state: "value",
				});
			});
		}
	}

	if (context.state === "sort_column") {
		// After "sort by", show available columns
		const matched = matchFn(context.currentInput, availableColumns);
		matched.forEach((col) => {
			addSuggestion({
				label: col,
				value: `${context.sortKeyword} ${col}`,
				type: "sort_column",
				state: "sort_column",
			});
		});
	}

	if (context.state === "sort_direction") {
		// After "sort by column", show asc/desc options
		const directions = ["asc", "desc"];
		const matched = matchFn(context.currentInput, directions);
		matched.forEach((dir) => {
			addSuggestion({
				label: dir,
				value: `${context.sortKeyword} ${context.sortColumn} ${dir}`,
				type: "sort_direction",
				state: "sort_direction",
			});
		});
	}

	if (context.state === "complete" && !context.sortKeyword) {
		// Show additional clauses (order by, limit)
		const matched = matchFn(context.currentInput, commands);
		matched.forEach((clause) => {
			addSuggestion({
				label: `${clause}`,
				value: ` ${clause} `,
				type: "example",
				state: "complete",
			});
		});
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

	// Show all available columns as column examples
	availableColumns.forEach((col) => {
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
			label: `${col1} = something`,
			value: `${col1} = something`,
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
