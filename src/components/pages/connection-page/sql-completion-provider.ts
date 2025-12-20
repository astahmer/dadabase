import type * as MonacoType from "monaco-editor";
import type { TableWithColumnsMetadata } from "#src/server/introspection/introspection.ts";
import {
	createAsteriskCompletion,
	createColumnCompletion,
	createKeywordCompletion,
	createOperatorCompletion,
	createTableCompletion,
	detectCompletionContext,
	getContextualKeywords,
} from "./sql-completion-helper";

export function sqlCompletionProvider(
	input: {
		fullText: string;
		cursorOffset: number;
	},
	context: {
		tables: Array<{ schema: string; name: string }>;
		columns: TableWithColumnsMetadata[];
		hasMultipleSchemas: boolean;
	},
	monaco: typeof MonacoType,
) {
	const cursorContext = detectCompletionContext(
		input.fullText,
		input.cursorOffset,
	);
	const suggestions: MonacoType.languages.CompletionItem[] = [];

	// SELECT asterisk with all table.column combinations
	if (cursorContext.type === "select_start") {
		// Add asterisk as first suggestion
		suggestions.push(createAsteriskCompletion(monaco));

		// Add all table.column combinations
		for (const table of context.tables) {
			const tableCols = context.columns.find(
				(c) => c.table === table.name,
			)?.columns;
			if (tableCols) {
				for (const col of tableCols) {
					suggestions.push(
						createColumnCompletion(col.name, table.name, cursorContext, monaco),
					);
				}
			}
		}
	}

	// After "SELECT *", suggest FROM keyword
	if (cursorContext.type === "select_asterisk") {
		suggestions.push(createKeywordCompletion("FROM", monaco));
	}

	// Suggest operators after column reference
	if (cursorContext.type === "column_operator") {
		const operators = [
			"=",
			"!=",
			"<>",
			"<",
			">",
			"<=",
			">=",
			"BETWEEN",
			"IN",
			"LIKE",
			"IS NULL",
			"IS NOT NULL",
		];
		suggestions.push(
			...operators.map((op) => createOperatorCompletion(op, monaco)),
		);
	}

	// Suggest tables when after FROM/JOIN keywords
	if (
		cursorContext.type === "from_keyword" ||
		cursorContext.type === "table_after_from"
	) {
		suggestions.push(
			...context.tables.map((table) =>
				createTableCompletion(
					table,
					cursorContext,
					context.hasMultipleSchemas,
					monaco,
				),
			),
		);
	}

	// Suggest tables+columns combo on empty line
	if (cursorContext.type === "empty_line") {
		// Suggest all tables
		suggestions.push(
			...context.tables.map((table) =>
				createTableCompletion(
					table,
					cursorContext,
					context.hasMultipleSchemas,
					monaco,
				),
			),
		);

		// Also suggest table.column combinations
		for (const table of context.tables) {
			const tableCols = context.columns.find(
				(c) => c.table === table.name,
			)?.columns;
			if (tableCols && tableCols.length > 0) {
				// Limit to first 5 columns per table to avoid clutter
				for (const col of tableCols.slice(0, 5)) {
					suggestions.push(
						createColumnCompletion(col.name, table.name, cursorContext, monaco),
					);
				}
			}
		}
	}

	// Suggest keywords after table names or after completed conditions
	if (
		cursorContext.type === "keyword_after_table" ||
		cursorContext.type === "table_alias" ||
		cursorContext.type === "after_condition" ||
		cursorContext.type === "after_having_condition" ||
		cursorContext.type === "after_order_by_column" ||
		cursorContext.type === "join_table"
	) {
		const keywords = getContextualKeywords(cursorContext);
		suggestions.push(
			...keywords.map((kw) => createKeywordCompletion(kw, monaco)),
		);
	}

	// Suggest columns when after column-expecting keywords
	if (cursorContext.type === "column_after_keyword") {
		const selectedTables =
			cursorContext.selectedTables.length > 0
				? cursorContext.selectedTables
				: context.tables.map((t) => t.name);

		// When multiple tables are explicitly aliased, keep columns distinct by table+alias
		// Otherwise, deduplicate columns with the same name
		const allTablesAreAliased = selectedTables.every(
			(t) => cursorContext.tableAliases[t],
		);
		const shouldKeepAllColumns =
			selectedTables.length > 1 && allTablesAreAliased;

		// Map of either "colName" or "tableName.colName" to tableName
		const availableColumns = new Map<string, string>();

		for (const tableName of selectedTables) {
			const tableCols = context.columns.find(
				(c) => c.table === tableName,
			)?.columns;
			if (tableCols) {
				for (const col of tableCols) {
					// Create key for uniqueness - use table.column when we need to keep all columns
					const key = shouldKeepAllColumns
						? `${tableName}.${col.name}`
						: col.name;
					// Track which table this column came from
					if (!availableColumns.has(key)) {
						availableColumns.set(key, tableName);
					}
				}
			}
		}

		suggestions.push(
			...Array.from(availableColumns.entries()).map(([_key, tableName]) => {
				// Extract column name from key (either "col" or "table.col")
				const colName = shouldKeepAllColumns ? _key.split(".")[1] : _key;
				// Use alias if available, otherwise use table name
				const tableRefName = cursorContext.tableAliases[tableName] ?? tableName;
				return createColumnCompletion(
					colName,
					tableRefName,
					cursorContext,
					monaco,
				);
			}),
		);
	}

	console.log("context", { cursorContext, context, suggestions });

	return suggestions;
}
