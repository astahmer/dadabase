/**
 * Advanced SQL completion helper for intelligent suggestion context detection
 */

import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

export interface CompletionContext {
  type:
    | "none"
    | "from_keyword"
    | "table_after_from"
    | "empty_line"
    | "keyword_after_table"
    | "column_after_keyword"
    | "table_alias"
    | "select_start"
    | "select_asterisk"
    | "column_operator"
    | "after_condition"
    | "join_table"
    | "join_with_alias"
    | "after_order_by_column"
    | "after_having_condition"
    | "after_order_by_direction"
    | "subquery_start"
    | "partial_join_keyword";
  selectedTables: ExtractedTable[];
  tableAliases: Record<string, string>; // Maps table name to alias (e.g., { "users": "u", "posts": "p" })
  lastKeyword?: SqlKeyword;
  isAtLineStart: boolean;
  beforeCursor: string;
}

const SQL_KEYWORDS = [
  "SELECT",
  "CREATE",
  "ALTER",
  "DROP",
  "AS",
  "WITH",
  "INSERT",
  "UPDATE",
  "DELETE",
  "WHERE",
  "ORDER BY",
  "GROUP BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "DISTINCT",
  "UNION",
  "UNION ALL",
  "INTERSECT",
  // "FOR UPDATE",
  // "LOCK IN SHARE MODE",
  // "EXCEPT",
  // "FETCH FIRST",
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
  "ASC",
  "DESC",
  "NULLS FIRST",
  "NULLS LAST",
] as const;
export type SqlKeyword = (typeof SQL_KEYWORDS)[number];

// Memoized regex patterns (compiled once)
// Reusable pattern fragments
const JOIN_KEYWORDS =
  "FROM|JOIN|INNER\\s+JOIN|LEFT\\s+JOIN|RIGHT\\s+JOIN|FULL\\s+JOIN|CROSS\\s+JOIN";

// Keywords for table extraction that include INSERT INTO, UPDATE, DELETE FROM, etc.
const TABLE_SOURCE_KEYWORDS =
  "FROM|JOIN|INNER\\s+JOIN|LEFT\\s+JOIN|RIGHT\\s+JOIN|FULL\\s+JOIN|CROSS\\s+JOIN|INTO|UPDATE|DELETE\\s+FROM";

const REGEX_SELECT_START = /\bselect\s+$/i;
const REGEX_SELECT_ASTERISK = /\bselect\s+\*\s+$/i;
const REGEX_COLUMN_OPERATOR =
  /\b(WHERE|ON|HAVING|AND|OR)\s+(?:"[^"]+"|[\w]+)\.(?:"[^"]+"|[\w]+)\s+$/i;
const REGEX_TABLE_ALIAS_INCOMPLETE = /\bAS\s*$/i;
const REGEX_TABLE_ALIAS_COMPLETE = /\bAS\s+(\w+)\s*$/i;
const REGEX_FROM_KEYWORD = /\bfrom\s+$/i;
const REGEX_TABLE_NAME = new RegExp(`\\b(?:${JOIN_KEYWORDS})\\s+(?:"[^"]*"|\\w*)$`, "i");
const REGEX_SELECT_QUALIFIED = /\bSELECT\s+(?:"[^"]*"|\w+)\.(?:"[^"]*"|\w+)\s*$/i;
// Updated to handle schema-qualified table names (e.g., "public"."users", public.users, etc.)
// Matches: FROM/JOIN table_name [AS alias] followed by optional whitespace
// Order matters: more specific patterns first (schema.table), then less specific (table only)
// The trailing \s* makes the space optional to handle cases where cursor is right at the table name
const REGEX_KEYWORD_AFTER_TABLE = new RegExp(
  `\\b(${JOIN_KEYWORDS})\\s+(?:"[^"]+"\\.\\w+|\\w+\\."[^"]+"|"[^"]+"\\."[^"]+"|\\w+\\.\\w+|"[^"]+"|\\w+)(?:\\s+AS\\s+\\w+)?\\s*$`,
  "i",
);
const REGEX_JOIN_TABLE_WITHOUT_ALIAS = new RegExp(
  `\\b(JOIN|INNER\\s+JOIN|LEFT\\s+JOIN|RIGHT\\s+JOIN|FULL\\s+JOIN|CROSS\\s+JOIN)\\s+(\\w+|"[^"]*")\\s+$`,
  "i",
);
const REGEX_JOIN_TABLE_WITH_ALIAS = new RegExp(
  `\\b(JOIN|INNER\\s+JOIN|LEFT\\s+JOIN|RIGHT\\s+JOIN|FULL\\s+JOIN|CROSS\\s+JOIN)\\s+(\\w+|"[^"]*")\\s+AS\\s+(\\w+)\\s+$`,
  "i",
);
const REGEX_JOIN_WITH_ALIAS_COMPLETE = new RegExp(
  `\\b(INNER\\s+JOIN|LEFT\\s+JOIN|RIGHT\\s+JOIN|FULL\\s+JOIN|FULL\\s+OUTER\\s+JOIN|LEFT\\s+OUTER\\s+JOIN|RIGHT\\s+OUTER\\s+JOIN|CROSS\\s+JOIN|JOIN)\\s+(?:\\w+|"[^"]*")\\s+(?:AS\\s+)\\w+\\s+$`,
  "i",
);
// Updated to handle schema-qualified table names in all quoting styles:
// - "public"."users" (fully quoted)
// - "public".users (mixed quoted)
// - public."users" (mixed quoted)
// - public.users (unquoted)
// - "users" (quoted table only)
// - users (unquoted table only)
// Also matches INSERT INTO, UPDATE, and DELETE FROM statements
const REGEX_TABLE_PATTERN = new RegExp(
  `\\b(?:${TABLE_SOURCE_KEYWORDS})\\s+(?:"([^"]+)"\\."([^"]+)"|"([^"]+)"\\.(\\w+)|(\\w+)\\."([^"]+)"|(\\w+)\\.(\\w+)|"([^"]+)"|(\\w+))`,
  "gi",
);
const REGEX_TABLE_ALIAS_PAIR = new RegExp(
  `\\b(?:${JOIN_KEYWORDS})\\s+(?:"([^"]+)"|(\\w+))\\s+AS\\s+(\\w+)`,
  "gi",
);
const REGEX_KEYWORD_PATTERN =
  /\b(SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|ON|ORDER|GROUP|HAVING|LIMIT|AND|OR)\b/gi;
const REGEX_FUNCTION_WITH_TABLE =
  /\b(COUNT|SUM|AVG|MAX|MIN|LOWER|UPPER|COALESCE|CASE|EXISTS)\s*\(\s*(?:"[^"]+"|[\w]+)\.$/i;
// Detect completed WHERE/ON/HAVING conditions: column/qualified_column/function operator value(s)
// Matches patterns like: WHERE category = "xxx" , WHERE "table"."column" > 5 , WHERE col IS NULL , WHERE col LIKE '%pattern%'
// Also matches HAVING conditions like: HAVING COUNT(*) > 5, HAVING SUM(amount) < 100
// Ensures there's actual content after the operator (not just the operator with trailing space)
const REGEX_COMPLETED_CONDITION =
  /\b(WHERE|ON|HAVING|AND|OR)\s+(?:(?:(?:"[^"]+"|[\w]+)\.)?(?:"[^"]+"|[\w]+)|(?:COUNT|SUM|AVG|MAX|MIN)\s*\([^)]*\))\s+(?:=|!=|<>|<|>|<=|>=|BETWEEN|IN|EXISTS)\s+(?:(?:"[^"]+"|[\w]+)\.)?(?:"[^"]+"|[\w]+|'[^']*'|\d+)\s+$/i;

// Detect ORDER BY column (not with ASC/DESC yet) - supports comma-separated columns
const REGEX_ORDER_BY_COLUMN =
  /\bORDER\s+BY\s+(?:.*?,)?\s*(?:(?:"[^"]+"|[\w]+)\.)?(?:"[^"]+"|[\w]+)\s+$/i;

// Detect ORDER BY column with sort direction (ASC/DESC)
const REGEX_ORDER_BY_WITH_DIRECTION = /\b(?:ASC|DESC)\s+$/i;

// Detect ORDER BY with ASC/DESC and optional NULLS FIRST/LAST
const REGEX_ORDER_BY_WITH_NULLS = /\b(?:NULLS\s+(?:FIRST|LAST))\s+$/i;

// Detect partial JOIN keywords (LEFT, RIGHT, INNER, FULL, CROSS without JOIN yet)
const REGEX_PARTIAL_JOIN_KEYWORD = /\b(LEFT|RIGHT|INNER|FULL|CROSS)\s+$/i;

// Detect opening parenthesis (for subqueries) - NOT after function names
const REGEX_OPENING_PAREN =
  /(?<!COUNT|SUM|AVG|MAX|MIN|LOWER|UPPER|COALESCE|CASE|EXISTS|CAST)\s*\(\s*$/;

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

  // Check if we've completed a column in ORDER BY clause (ready for ASC/DESC)
  // MUST check this before COMPLETED_CONDITION since ORDER BY doesn't have operators
  if (REGEX_ORDER_BY_COLUMN.test(beforeCursor)) {
    return {
      type: "after_order_by_column",
      selectedTables,
      tableAliases,
      isAtLineStart,
      beforeCursor,
    };
  }

  // Check if we're after an ORDER BY sort direction (ASC or DESC)
  // In this case, suggest LIMIT, OFFSET, etc.
  if (REGEX_ORDER_BY_WITH_DIRECTION.test(beforeCursor)) {
    // Check that there's actually an ORDER BY before this
    if (/\bORDER\s+BY\b/i.test(beforeCursor)) {
      // Check if we're already at NULLS FIRST/LAST
      if (REGEX_ORDER_BY_WITH_NULLS.test(beforeCursor)) {
        return {
          type: "after_condition",
          selectedTables,
          tableAliases,
          lastKeyword: "ORDER" as SqlKeyword,
          isAtLineStart,
          beforeCursor,
        };
      }
      // Otherwise, after ASC/DESC, suggest NULLS FIRST/LAST
      return {
        type: "after_order_by_direction",
        selectedTables,
        tableAliases,
        isAtLineStart,
        beforeCursor,
      };
    }
  }

  // Check if we're after NULLS FIRST/LAST
  if (REGEX_ORDER_BY_WITH_NULLS.test(beforeCursor)) {
    return {
      type: "after_condition",
      selectedTables,
      tableAliases,
      lastKeyword: "ORDER BY" as SqlKeyword,
      isAtLineStart,
      beforeCursor,
    };
  }

  // Check for opening parenthesis (subquery start)
  if (REGEX_OPENING_PAREN.test(beforeCursor)) {
    return {
      type: "subquery_start",
      selectedTables,
      tableAliases,
      isAtLineStart: false,
      beforeCursor,
    };
  }

  // Check if we've completed a WHERE/ON/HAVING condition (e.g., "WHERE column = value ")
  // This should suggest AND, OR, LIMIT, ORDER BY, etc. (or WHERE if after ON)
  if (REGEX_COMPLETED_CONDITION.test(beforeCursor)) {
    const lastKeyword = findLastKeywordContext(beforeCursor);
    // Distinguish HAVING conditions from WHERE/AND/OR conditions
    if (lastKeyword === "HAVING" || beforeCursor.includes("HAVING")) {
      return {
        type: "after_having_condition",
        selectedTables,
        tableAliases,
        lastKeyword,
        isAtLineStart,
        beforeCursor,
      };
    }
    return {
      type: "after_condition",
      selectedTables,
      tableAliases,
      lastKeyword,
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

  // Check if we just typed a partial JOIN keyword (LEFT, RIGHT, INNER, FULL, CROSS)
  // In this case, suggest "JOIN" to complete the keyword
  if (REGEX_PARTIAL_JOIN_KEYWORD.test(beforeCursor)) {
    return {
      type: "partial_join_keyword",
      selectedTables,
      tableAliases,
      isAtLineStart,
      beforeCursor,
    };
  }

  // Check for JOIN with alias completed FIRST (before checking generic table_alias)
  // This must come before the table_alias check!
  if (REGEX_JOIN_WITH_ALIAS_COMPLETE.test(beforeCursor)) {
    return {
      type: "join_with_alias",
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

  // Check for table after JOIN without alias (should suggest AS and ON)
  if (
    REGEX_JOIN_TABLE_WITHOUT_ALIAS.test(beforeCursor) &&
    !REGEX_JOIN_TABLE_WITH_ALIAS.test(beforeCursor)
  ) {
    return {
      type: "join_table",
      selectedTables,
      tableAliases,
      isAtLineStart,
      beforeCursor,
    };
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
export interface ExtractedTable {
  schema?: string;
  table: string;
}

export function extractSelectedTables(sql: string): ExtractedTable[] {
  const tables = new Map<string, ExtractedTable>();

  // Match all FROM and JOIN clauses with table names
  let match;
  // Reset regex state for reuse
  REGEX_TABLE_PATTERN.lastIndex = 0;
  while ((match = REGEX_TABLE_PATTERN.exec(sql)) !== null) {
    let extracted: ExtractedTable | undefined;

    // Fully quoted schema.table: "public"."users"
    if (match[1] && match[2]) {
      extracted = { schema: match[1], table: match[2] };
    }
    // Quoted schema, unquoted table: "public".users
    else if (match[3] && match[4]) {
      extracted = { schema: match[3], table: match[4] };
    }
    // Unquoted schema, quoted table: public."users"
    else if (match[5] && match[6]) {
      extracted = { schema: match[5], table: match[6] };
    }
    // Unquoted schema.table: public.users
    else if (match[7] && match[8]) {
      extracted = { schema: match[7], table: match[8] };
    }
    // Just quoted table: "users"
    else if (match[9]) {
      extracted = { table: match[9] };
    }
    // Just unquoted table: users
    else if (match[10]) {
      extracted = { table: match[10] };
    }

    if (extracted) {
      // Use table name as key to avoid duplicates
      const key = `${extracted.schema ?? ""}:${extracted.table}`;
      tables.set(key, extracted);
    }
  }

  return Array.from(tables.values());
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

  return lastMatch ? (lastMatch[1].toUpperCase() as SqlKeyword) : undefined;
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
  const quotedName = hasMultipleSchemas ? `"${table.schema}"."${table.name}"` : `"${table.name}"`;

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
 * Format column metadata for display in completions
 */
function formatColumnMetadata(metadata: TableColumnMetadata | undefined): string {
  if (!metadata) return "Column";

  const parts: string[] = [metadata.dataType];

  if (metadata.nullable) {
    parts.push("nullable");
  }

  if (metadata.primaryKey) {
    parts.push("PRIMARY KEY");
  }

  if (metadata.unique) {
    parts.push("UNIQUE");
  }

  if (metadata.isForeignKey) {
    if (metadata.foreignKey) {
      parts.push(
        `references: ${metadata.foreignKey.referencedTable}(${metadata.foreignKey.referencedColumn})`,
      );
    } else {
      parts.push("FOREIGN KEY");
    }
  }

  if (metadata.defaultValue) {
    parts.push(`default: ${metadata.defaultValue}`);
  }

  return parts.join(" | ");
}

/**
 * Generate completion item for a column with smart insert text
 */
export function createColumnCompletion(
  columnName: string,
  tableName: string | null,
  context: CompletionContext,
  monaco: any,
  metadata?: TableColumnMetadata,
) {
  // Determine whether to use qualified column names in insertText and label
  // Check if we're inside a function WITH a table dot (table.column pattern within function)
  const isInsideFunctionWithTable = REGEX_FUNCTION_WITH_TABLE.test(context.beforeCursor);

  // Check if we're in JOIN ON clause after a table reference
  const inJoinOnWithTable =
    context.lastKeyword === "ON" && context.beforeCursor.trimEnd().endsWith(".");

  // Check if cursor is right after a table name and dot (typing table.column)
  // Only when the table name is directly after a column-expecting keyword (not an alias)
  // Pattern: SELECT|WHERE|ON|HAVING|ORDER|GROUP <table_name>. or <table_name>"<table_name>".
  let afterTableDot = false;
  if (context.beforeCursor.trimEnd().endsWith(".") && context.type === "column_after_keyword") {
    const tableNameMatch = context.beforeCursor.match(
      /\b(SELECT|WHERE|ON|HAVING|ORDER|GROUP|CASE|WHEN)\s+(?:"([^"]+)"|(\w+))\s*\.\s*$/,
    );
    if (tableNameMatch) {
      const identifier = tableNameMatch[2] || tableNameMatch[3];
      const keyword = tableNameMatch[1];

      // For SELECT without FROM clause, always allow unqualified column names
      if (keyword === "SELECT" && context.selectedTables.length === 0) {
        afterTableDot = true;
      } else {
        // For other cases, check if it's an actual table name (not an alias)
        const isTableName = context.selectedTables.some((t) => t.table === identifier);
        afterTableDot = isTableName;
      }
    }
  }

  // Use unqualified names only when inside function with table, in JOIN ON with table, or after table dot
  const shouldUseQualified = !isInsideFunctionWithTable && !inJoinOnWithTable && !afterTableDot;

  let insertText =
    shouldUseQualified && tableName ? `"${tableName}"."${columnName}"` : `"${columnName}"`;

  // When on empty line with columns, insert select column from table
  if (context.type === "empty_line" && tableName) {
    insertText = `SELECT "${columnName}" FROM "${tableName}"`;
  }

  const label = shouldUseQualified && tableName ? `${tableName}.${columnName}` : columnName;

  return {
    label: label,
    kind: monaco.languages.CompletionItemKind.Field,
    detail: formatColumnMetadata(metadata),
    insertText,
    sortText: `1_${label}`,
    range: undefined,
  } as any;
}

/**
 * Get SQL keywords that are contextually appropriate
 */
export function getContextualKeywords(context: CompletionContext): SqlKeyword[] {
  if (context.type === "after_condition") {
    // After a completed WHERE/AND/OR condition, suggest AND/OR and other clauses
    // After a completed ON condition, suggest WHERE and other clauses (no AND/OR until WHERE is present)
    if (context.lastKeyword === "ON") {
      return ["WHERE", "ORDER BY", "GROUP BY", "LIMIT"];
    }

    // After ORDER BY with ASC/DESC or NULLS FIRST/LAST - only LIMIT and OFFSET allowed
    if (context.lastKeyword === "ORDER BY") {
      return ["LIMIT", "OFFSET"];
    }

    // After WHERE/AND/OR, suggest AND/OR to continue the condition
    return [
      "AND",
      "OR",
      "ORDER BY",
      "GROUP BY",
      "HAVING",
      "LIMIT",
      "OFFSET",
      "DISTINCT",
      "UNION",
      "UNION ALL",
      "INTERSECT",
    ];
  }

  if (context.type === "after_having_condition") {
    // After HAVING condition, suggest AND/OR (same as WHERE)
    return [
      "AND",
      "OR",
      "ORDER BY",
      "GROUP BY",
      "LIMIT",
      "OFFSET",
      "DISTINCT",
      "UNION",
      "UNION ALL",
      "INTERSECT",
    ];
  }

  if (context.type === "after_order_by_column") {
    // After ORDER BY column, suggest ASC/DESC
    return ["ASC", "DESC"];
  }

  if (context.type === "after_order_by_direction") {
    // After ASC/DESC in ORDER BY, suggest NULLS FIRST/LAST, or move to LIMIT
    return ["NULLS FIRST", "NULLS LAST", "LIMIT", "OFFSET"];
  }

  if (context.type === "subquery_start") {
    // After opening parenthesis, suggest SELECT for subquery
    return ["SELECT", "WITH"];
  }

  if (context.type === "join_table") {
    // After a table in a JOIN clause (no alias yet), suggest AS and ON
    return ["AS", "ON"];
  }

  if (context.type === "join_with_alias") {
    // After JOIN table AS alias, only suggest ON for the join condition
    return ["ON"];
  }

  if (context.type === "keyword_after_table" || context.type === "table_alias") {
    // After a table, suggest common SQL keywords
    const keywords: SqlKeyword[] = [
      "WHERE",
      "ORDER BY",
      "GROUP BY",
      "LIMIT",
      "JOIN",
      "LEFT JOIN",
      "INNER JOIN",
      "CROSS JOIN",
    ];

    // Only suggest AS for keyword_after_table (when we have a table name but haven't aliased yet)
    // Don't suggest it for table_alias (we just completed an alias)
    if (context.type === "keyword_after_table") {
      keywords.push("AS");
    }

    return keywords;
  }

  if (context.type === "empty_line") {
    // At the start, suggest major SQL keywords (CREATE, ALTER, DROP, SELECT, INSERT, UPDATE, DELETE, WITH)
    return ["SELECT", "CREATE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE", "WITH"];
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
