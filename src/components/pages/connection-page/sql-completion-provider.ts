import type * as MonacoType from "monaco-editor";
import {
    createAliasCompletion,
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
        columns: Record<string, Array<{ name: string; dataType: string }>>;
        hasMultipleSchemas: boolean;
    },
    monaco: typeof MonacoType,
) {
    const cursorContext = detectCompletionContext(input.fullText, input.cursorOffset);
    const suggestions: MonacoType.languages.CompletionItem[] =
        [];

    // 1. SELECT asterisk with all table.column combinations
    if (cursorContext.type === "select_start") {
        // Add asterisk as first suggestion
        suggestions.push(createAsteriskCompletion(monaco));

        // Add all table.column combinations
        for (const table of context.tables) {
            const tableCols = context.columns[table.name];
            if (tableCols) {
                for (const col of tableCols) {
                    suggestions.push(
                        createColumnCompletion(
                            `${table.name}.${col.name}`,
                            table.name,
                            cursorContext,
                            monaco,
                        ),
                    );
                }
            }
        }
    }

    // 2. After "SELECT *", suggest FROM keyword
    if (cursorContext.type === "select_asterisk") {
        suggestions.push(createKeywordCompletion("FROM", monaco));
    }

    // 3. Suggest table alias after AS keyword
    if (cursorContext.type === "table_alias") {
        // Get the table being aliased from the FROM/JOIN clause
        const lastTable = cursorContext.selectedTables[cursorContext.selectedTables.length - 1];
        if (lastTable) {
            suggestions.push(createAliasCompletion(lastTable, monaco));
        }
    }

    // 4. Suggest operators after column reference
    if (cursorContext.type === "column_operator") {
        const operators = ["=", "!=", "<>", "<", ">", "<=", ">=", "BETWEEN", "IN", "LIKE", "IS NULL", "IS NOT NULL"];
        suggestions.push(
            ...operators.map((op) => createOperatorCompletion(op, monaco)),
        );
    }

    // 5. Suggest tables when after FROM/JOIN keywords
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

    // 6. Suggest tables+columns combo on empty line
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
            const tableCols = context.columns[table.name];
            if (tableCols && tableCols.length > 0) {
                // Limit to first 5 columns per table to avoid clutter
                for (const col of tableCols.slice(0, 5)) {
                    suggestions.push(
                        createColumnCompletion(
                            col.name,
                            table.name,
                            cursorContext,
                            monaco,
                        ),
                    );
                }
            }
        }
    }

    // 7. Suggest keywords after table names
    if (cursorContext.type === "keyword_after_table") {
        const keywords = getContextualKeywords(cursorContext);
        suggestions.push(
            ...keywords.map((kw) => createKeywordCompletion(kw, monaco)),
        );
    }

    // 8. Suggest columns when after column-expecting keywords
    if (cursorContext.type === "column_after_keyword") {
        const selectedTables =
            cursorContext.selectedTables.length > 0
                ? cursorContext.selectedTables
                : context.tables.map((t) => t.name);

        // Collect all columns from selected tables
        const availableColumns = new Map<string, string>();

        for (const tableName of selectedTables) {
            const tableCols = context.columns[tableName];
            if (tableCols) {
                for (const col of tableCols) {
                    // Use column name as key, but track which table it came from
                    if (!availableColumns.has(col.name)) {
                        availableColumns.set(col.name, tableName);
                    }
                }
            }
        }

        suggestions.push(
            ...Array.from(availableColumns.entries()).map(
                ([colName, tableName]) =>
                    createColumnCompletion(colName, tableName, cursorContext, monaco),
            ),
        );
    }

    return suggestions;
}
