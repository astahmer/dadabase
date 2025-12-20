/**
 * Advanced SQL completion helper for intelligent suggestion context detection
 */

export interface CompletionContext {
    type: "none" | "from_keyword" | "table_after_from" | "empty_line" | "keyword_after_table" | "column_after_keyword";
    selectedTables: string[];
    lastKeyword?: string;
    isAtLineStart: boolean;
    beforeCursor: string;
}

const SQL_KEYWORDS = new Set([
    "WHERE",
    "ORDER",
    "GROUP",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "JOIN",
    "INNER",
    "LEFT",
    "RIGHT",
    "FULL",
    "CROSS",
    "ON",
    "AND",
    "OR",
    "NOT",
    "IN",
    "EXISTS",
    "BETWEEN",
    "LIKE",
    "IS",
    "NULL",
]);

/**
 * Detect the completion context for intelligent SQL suggestions
 */
export function detectCompletionContext(
    fullText: string,
    cursorPosition: number,
): CompletionContext {
    const beforeCursor = fullText.substring(0, cursorPosition);
    const lines = beforeCursor.split("\n");
    const currentLine = lines[lines.length - 1];
    const isAtLineStart = currentLine.trim().length === 0;

    // Extract all FROM/JOIN clause tables mentioned before cursor
    const selectedTables = extractSelectedTables(beforeCursor);

    // Check if we just typed "from " (case insensitive)
    const fromMatch = beforeCursor.match(/\bfrom\s+$/i);
    if (fromMatch) {
        return {
            type: "from_keyword",
            selectedTables,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Check if we're on an empty/whitespace-only line
    if (isAtLineStart) {
        return {
            type: "empty_line",
            selectedTables,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Check if we're in a table name position (after FROM/JOIN but before any keyword)
    // This regex matches FROM/JOIN followed by optional whitespace and a partial word
    const tableNamePattern =
        /\b(?:FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN)\s+(?:"[^"]*"|\w*)$/i;
    if (tableNamePattern.test(beforeCursor)) {
        return {
            type: "table_after_from",
            selectedTables,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Find the last significant keyword before cursor
    const lastKeyword = findLastKeywordContext(beforeCursor);

    // If we just finished a table name and the last keyword was FROM/JOIN, suggest keywords
    if (lastKeyword) {
        const keywordMatch = beforeCursor.match(
            /\b(FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN)\s+(\w+|\"\w+\")\s+$/i,
        );
        if (keywordMatch) {
            return {
                type: "keyword_after_table",
                selectedTables,
                lastKeyword,
                isAtLineStart,
                beforeCursor,
            };
        }

        // If we're after a keyword that expects columns, suggest columns
        const columnKeywords = [
            "WHERE",
            "SELECT",
            "ORDER",
            "GROUP",
            "ON",
            "HAVING",
        ];
        if (
            columnKeywords.some((kw) =>
                beforeCursor.match(new RegExp(`\\b${kw}\\b`, "i")),
            )
        ) {
            return {
                type: "column_after_keyword",
                selectedTables,
                lastKeyword,
                isAtLineStart,
                beforeCursor,
            };
        }
    }

    return {
        type: "none",
        selectedTables,
        isAtLineStart,
        beforeCursor,
    };
}

/**
 * Extract all table names that have been selected via FROM/JOIN clauses
 */
function extractSelectedTables(sql: string): string[] {
    const tables = new Set<string>();

    // Match all FROM and JOIN clauses with table names
    const tablePattern =
        /\b(?:FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN)\s+(?:"([^"]+)"|(\w+))/gi;

    let match;
    while ((match = tablePattern.exec(sql)) !== null) {
        const tableName = match[1] || match[2];
        if (tableName) {
            tables.add(tableName);
        }
    }

    return Array.from(tables);
}

/**
 * Find the last SQL keyword that appears before the cursor position
 */
function findLastKeywordContext(beforeCursor: string): string | undefined {
    const keywordPattern = /\b(SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|ON|ORDER|GROUP|HAVING|LIMIT|AND|OR)\b/gi;

    let lastMatch: RegExpExecArray | null = null;
    let match;

    while ((match = keywordPattern.exec(beforeCursor)) !== null) {
        lastMatch = match;
    }

    return lastMatch ? lastMatch[1].toUpperCase() : undefined;
}

/**
 * Generate completion item for a table with smart insert text
 */
export function createTableCompletion(
    table: { schema: string; name: string },
    context: CompletionContext,
    hasMultipleSchemas: boolean,
    monaco: any,
) {
    const quotedName = hasMultipleSchemas
        ? `"${table.schema}"."${table.name}"`
        : `"${table.name}"`;

    let insertText = quotedName;

    // When starting from a FROM keyword, insert table name with trailing space
    if (context.type === "from_keyword") {
        insertText = `${quotedName} `;
    }

    // When on empty line, insert the full select statement
    if (context.type === "empty_line") {
        insertText = `SELECT * FROM ${quotedName}`;
    }

    // When typing table name after FROM/JOIN, insert with trailing space
    if (context.type === "table_after_from") {
        insertText = `${quotedName} `;
    }

    return {
        label: table.name,
        kind: monaco.languages.CompletionItemKind.Struct,
        detail: `Table${hasMultipleSchemas ? ` in schema: ${table.schema}` : ""}`,
        insertText,
        sortText: `1_${table.name}`,
        range: undefined,
    } as any;
}

/**
 * Generate completion item for a column with smart insert text
 */
export function createColumnCompletion(
    columnName: string,
    tableName: string | null,
    context: CompletionContext,
    monaco: any,
) {
    let insertText = `"${columnName}"`;

    // When on empty line with columns, insert select column from table
    if (context.type === "empty_line" && tableName) {
        insertText = `SELECT "${columnName}" FROM "${tableName}"`;
    }

    return {
        label: columnName,
        kind: monaco.languages.CompletionItemKind.Field,
        detail: "Column",
        insertText,
        sortText: `1_${columnName}`,
        range: undefined,
    } as any;
}

/**
 * Get SQL keywords that are contextually appropriate
 */
export function getContextualKeywords(context: CompletionContext): string[] {
    if (context.type === "keyword_after_table") {
        // After a table, suggest common SQL keywords
        return [
            "WHERE",
            "ORDER BY",
            "GROUP BY",
            "LIMIT",
            "JOIN",
            "LEFT JOIN",
            "INNER JOIN",
        ];
    }

    if (context.type === "empty_line") {
        // At the start, suggest SELECT, WITH, INSERT, UPDATE, DELETE
        return ["SELECT", "WITH", "INSERT", "UPDATE", "DELETE"];
    }

    return [];
}

/**
 * Create completion items for keywords
 */
export function createKeywordCompletion(keyword: string, monaco: any) {
    return {
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: `${keyword} `,
        sortText: `2_${keyword}`,
        detail: "SQL Keyword",
        range: undefined,
    } as any;
}
