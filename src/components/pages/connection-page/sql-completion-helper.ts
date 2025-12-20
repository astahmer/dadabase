/**
 * Advanced SQL completion helper for intelligent suggestion context detection
 */

export interface CompletionContext {
    type: "none" | "from_keyword" | "table_after_from" | "empty_line" | "keyword_after_table" | "column_after_keyword" | "table_alias" | "select_start" | "select_asterisk" | "column_operator";
    selectedTables: string[];
    tableAliases: Record<string, string>; // Maps table name to alias (e.g., { "users": "u", "posts": "p" })
    lastKeyword?: SqlKeyword;
    isAtLineStart: boolean;
    beforeCursor: string;
}

const SQL_KEYWORDS = ([
    "SELECT",
    "AS",
    "WITH", "INSERT", "UPDATE", "DELETE",
    "WHERE",
    "ORDER BY",
    "GROUP BY",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "INNER",
    "LEFT",
    "RIGHT",
    "JOIN",
    "INNER JOIN",
    "LEFT JOIN",
    "RIGHT JOIN",
    "CROSS JOIN",
    "FULL OUTER JOIN",
    "LEFT OUTER JOIN",
    "RIGHT OUTER JOIN",
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
]) as const;
type SqlKeyword = typeof SQL_KEYWORDS[number];

// Memoized regex patterns (compiled once)
// Reusable pattern fragments
const JOIN_KEYWORDS = "FROM|JOIN|INNER\\s+JOIN|LEFT\\s+JOIN|RIGHT\\s+JOIN|FULL\\s+JOIN|CROSS\\s+JOIN";

const REGEX_SELECT_START = /\bselect\s+$/i;
const REGEX_SELECT_ASTERISK = /\bselect\s+\*\s+$/i;
const REGEX_COLUMN_OPERATOR = /\b(WHERE|ON|HAVING|AND|OR)\s+(?:"[^"]+"|[\w]+)\.(?:"[^"]+"|[\w]+)\s+$/i;
const REGEX_TABLE_ALIAS_INCOMPLETE = /\bAS\s*$/i;
const REGEX_TABLE_ALIAS_COMPLETE = /\bAS\s+(\w+)\s*$/i;
const REGEX_FROM_KEYWORD = /\bfrom\s+$/i;
const REGEX_TABLE_NAME = new RegExp(`\\b(?:${JOIN_KEYWORDS})\\s+(?:"[^"]*"|\\w*)$`, "i");
const REGEX_SELECT_QUALIFIED = /\bSELECT\s+(?:"[^"]*"|\w+)\.(?:"[^"]*"|\w+)\s*$/i;
const REGEX_KEYWORD_AFTER_TABLE = new RegExp(`\\b(${JOIN_KEYWORDS})\\s+(\\w+|"\\w+")(AS\s+(\w*))?\\s+$`, "i");
const REGEX_TABLE_PATTERN = new RegExp(`\\b(?:${JOIN_KEYWORDS})\\s+(?:"([^"]+)"|(\\w+))`, "gi");
const REGEX_TABLE_ALIAS_PAIR = new RegExp(`\\b(?:${JOIN_KEYWORDS})\\s+(?:"([^"]+)"|(\\w+))\\s+AS\\s+(\\w+)`, "gi");
const REGEX_KEYWORD_PATTERN = /\b(SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|ON|ORDER|GROUP|HAVING|LIMIT|AND|OR)\b/gi;
const REGEX_FUNCTION_WITH_TABLE = /\b(COUNT|SUM|AVG|MAX|MIN|LOWER|UPPER|COALESCE|CASE|EXISTS)\s*\(\s*(?:"[^"]+"|[\w]+)\.$/i;

// Memoized keyword patterns for column context detection
const COLUMN_KEYWORDS_PATTERN = {
    WHERE: /\bWHERE\b/i,
    SELECT: /\bSELECT\b/i,
    ORDER: /\bORDER\b/i,
    GROUP: /\bGROUP\b/i,
    ON: /\bON\b/i,
    HAVING: /\bHAVING\b/i,
};

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
    const tableAliases = extractTableAliases(beforeCursor);

    // Check if we're after SELECT keyword with just "select " or "select *"
    const selectMatch = REGEX_SELECT_START.test(beforeCursor);
    if (selectMatch) {
        return {
            type: "select_start",
            selectedTables,
            tableAliases,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Check if we're after "select * " (should suggest FROM)
    const selectAsteriskMatch = REGEX_SELECT_ASTERISK.test(beforeCursor);
    if (selectAsteriskMatch) {
        return {
            type: "select_asterisk",
            selectedTables,
            tableAliases,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Check if we're after a column name in WHERE/ON/HAVING (should suggest operators)
    // Match: WHERE|ON|HAVING table.column or table.quoted_column followed by space
    if (REGEX_COLUMN_OPERATOR.test(beforeCursor)) {
        return {
            type: "column_operator",
            selectedTables,
            tableAliases,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Check if we're in the middle of typing an alias (just "AS " with nothing after) - no suggestions
    if (REGEX_TABLE_ALIAS_INCOMPLETE.test(beforeCursor)) {
        return {
            type: "none",
            selectedTables,
            tableAliases,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Check if we're after a complete alias ("AS aliasName ") - should suggest keywords
    const aliasMatch = REGEX_TABLE_ALIAS_COMPLETE.exec(beforeCursor);
    if (aliasMatch) {
        return {
            type: "table_alias",
            selectedTables,
            tableAliases,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Check if we just typed "from " (case insensitive)
    const fromMatch = REGEX_FROM_KEYWORD.test(beforeCursor);
    if (fromMatch) {
        return {
            type: "from_keyword",
            selectedTables,
            tableAliases,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Check if we're on an empty/whitespace-only line
    if (isAtLineStart) {
        return {
            type: "empty_line",
            selectedTables,
            tableAliases,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Check if we're in a table name position (after FROM/JOIN but before any keyword)
    // This regex matches FROM/JOIN followed by optional whitespace and a partial word
    if (REGEX_TABLE_NAME.test(beforeCursor)) {
        return {
            type: "table_after_from",
            selectedTables,
            tableAliases,
            isAtLineStart,
            beforeCursor,
        };
    }

    // Find the last significant keyword before cursor
    const lastKeyword = findLastKeywordContext(beforeCursor);

    // Check if we're after SELECT with a complete qualified column reference
    // e.g., SELECT "table"."column" - should suggest FROM/WHERE, not more columns
    if (lastKeyword === "SELECT") {
        const selectQualifiedMatch = REGEX_SELECT_QUALIFIED.test(beforeCursor);
        if (selectQualifiedMatch) {
            return {
                type: "keyword_after_table",
                selectedTables,
                tableAliases,
                lastKeyword,
                isAtLineStart,
                beforeCursor,
            };
        }
    }

    // If we just finished a table name and the last keyword was FROM/JOIN, suggest keywords
    if (lastKeyword) {
        const keywordMatch = REGEX_KEYWORD_AFTER_TABLE.test(beforeCursor);
        if (keywordMatch) {
            return {
                type: "keyword_after_table",
                selectedTables,
                tableAliases,
                lastKeyword,
                isAtLineStart,
                beforeCursor,
            };
        }

        // If we're after a keyword that expects columns, suggest columns
        // But exclude cases where we've already written a complete column expression
        const columnKeywords = ["WHERE", "SELECT", "ORDER", "GROUP", "ON", "HAVING"] as const;
        if (
            columnKeywords.some((kw) => {
                const pattern = COLUMN_KEYWORDS_PATTERN[kw];
                return pattern.test(beforeCursor);
            })
        ) {
            return {
                type: "column_after_keyword",
                selectedTables,
                tableAliases,
                lastKeyword,
                isAtLineStart,
                beforeCursor,
            };
        }
    }

    return {
        type: "none",
        selectedTables,
        tableAliases,
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
    let match;
    // Reset regex state for reuse
    REGEX_TABLE_PATTERN.lastIndex = 0;
    while ((match = REGEX_TABLE_PATTERN.exec(sql)) !== null) {
        const tableName = match[1] || match[2];
        if (tableName) {
            tables.add(tableName);
        }
    }

    return Array.from(tables);
}

/**
 * Extract table aliases (maps table name to alias)
 */
function extractTableAliases(sql: string): Record<string, string> {
    const aliases: Record<string, string> = {};

    // Match all FROM and JOIN clauses with table names and aliases
    let match;
    // Reset regex state for reuse
    REGEX_TABLE_ALIAS_PAIR.lastIndex = 0;
    while ((match = REGEX_TABLE_ALIAS_PAIR.exec(sql)) !== null) {
        const tableName = match[1] || match[2];
        const alias = match[3];
        if (tableName && alias) {
            aliases[tableName] = alias;
        }
    }

    return aliases;
}

/**
 * Find the last SQL keyword that appears before the cursor position
 */
function findLastKeywordContext(beforeCursor: string): SqlKeyword | undefined {
    let lastMatch: RegExpExecArray | null = null;
    let match;

    // Reset regex state for reuse
    REGEX_KEYWORD_PATTERN.lastIndex = 0;
    while ((match = REGEX_KEYWORD_PATTERN.exec(beforeCursor)) !== null) {
        lastMatch = match;
    }

    return lastMatch ? lastMatch[1].toUpperCase() as SqlKeyword : undefined;
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
    let insertText = `${tableName ? `"${tableName}".` : ""}"${columnName}"`;

    // When on empty line with columns, insert select column from table
    if (context.type === "empty_line" && tableName) {
        insertText = `SELECT "${columnName}" FROM "${tableName}"`;
    }

    // Determine whether to use qualified column names (with table prefix)
    // Return plain names for:
    // 1. ORDER BY, GROUP BY, HAVING contexts
    // 2. When inside a function WITH table reference (e.g., AVG(posts. or COUNT(users.)
    // 3. When in JOIN ON and table already specified
    const isOrderByGroupByContext = ["ORDER", "GROUP", "HAVING"].includes(context.lastKeyword || "");

    // Check if we're inside a function WITH a table dot (table.column pattern within function)
    const isInsideFunctionWithTable = REGEX_FUNCTION_WITH_TABLE.test(context.beforeCursor);

    // Check if we're in JOIN ON clause after a table reference
    const inJoinOnWithTable = context.lastKeyword === "ON" && context.beforeCursor.trimEnd().endsWith(".");

    const shouldUseQualified = !isOrderByGroupByContext && !isInsideFunctionWithTable && !inJoinOnWithTable;

    const label = shouldUseQualified && tableName ? `${tableName}.${columnName}` : columnName;

    return {
        label: label,
        kind: monaco.languages.CompletionItemKind.Field,
        detail: "Column",
        insertText,
        sortText: `1_${label}`,
        range: undefined,
    } as any;
}

/**
 * Get SQL keywords that are contextually appropriate
 */
export function getContextualKeywords(context: CompletionContext): SqlKeyword[] {
    if (context.type === "keyword_after_table" || context.type === "table_alias") {
        // After a table, suggest common SQL keywords
        return [
            "WHERE",
            "ORDER BY",
            "GROUP BY",
            "LIMIT",
            "JOIN",
            "LEFT JOIN",
            "INNER JOIN",
            "AS"
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

/**
 * Create completion item for asterisk (*)
 */
export function createAsteriskCompletion(monaco: any) {
    return {
        label: "*",
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: "* ",
        sortText: "0_*",
        detail: "All columns",
        range: undefined,
    } as any;
}

/**
 * Create completion item for table alias (extracted from table name)
 */
export function createAliasCompletion(tableName: string, monaco: any) {
    // Extract just the table name without schema prefix
    const aliasName = tableName.replace(/^[^.]+\./, "");
    return {
        label: aliasName,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: `${aliasName} `,
        sortText: `1_${aliasName}`,
        detail: "Table alias",
        range: undefined,
    } as any;
}

/**
 * Create completion items for SQL operators
 */
export function createOperatorCompletion(operator: string, monaco: any) {
    return {
        label: operator,
        kind: monaco.languages.CompletionItemKind.Operator,
        insertText: `${operator} `,
        sortText: `2_${operator}`,
        detail: "Operator",
        range: undefined,
    } as any;
}
