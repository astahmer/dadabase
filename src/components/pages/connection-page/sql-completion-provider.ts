import type * as MonacoType from "monaco-editor";

import type {
  TableColumnMetadata,
  TableWithColumnsMetadata,
} from "#src/server/introspection/introspection.ts";

import {
  buildInsertValuesSnippet,
  isAfterInsertIntoTable,
  isAfterIntoKeyword,
} from "./build-insert-values-snippet.ts";
import { buildJoinOnSnippet, isAfterJoinKeyword } from "./build-join-on-snippet.ts";
import { COMPARISON_OPERATORS } from "./comparison-operators.ts";
import {
  createAsteriskCompletion,
  createColumnAliasCompletion,
  createColumnCompletion,
  createKeywordCompletion,
  createOperatorCompletion,
  createTableCompletion,
  detectCompletionContext,
  getContextualKeywords,
} from "./sql-completion-helper";
import { parseSelectColumnAliases } from "./sql-query-parser.ts";

// https://forcedotcom.github.io/phoenix/index.html#order

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
  const cursorContext = detectCompletionContext(input.fullText, input.cursorOffset);
  const suggestions: MonacoType.languages.CompletionItem[] = [];

  // SELECT asterisk with all table.column combinations
  if (cursorContext.type === "select_start") {
    // Add asterisk as first suggestion
    suggestions.push(createAsteriskCompletion(monaco));

    // Add all table.column combinations
    for (const table of context.tables) {
      const tableCols = context.columns.find((c) => c.table === table.name)?.columns;
      if (tableCols) {
        for (const col of tableCols) {
          suggestions.push(
            createColumnCompletion(col.name, table.name, cursorContext, monaco, col),
          );
        }
      }
    }
  }

  // After "SELECT *", suggest FROM keyword
  if (cursorContext.type === "select_asterisk") {
    suggestions.push(createKeywordCompletion("FROM", monaco));
  }

  // Suggest operators after column reference (includes inverted NOT LIKE / NOT IN / NOT BETWEEN)
  if (cursorContext.type === "column_operator") {
    suggestions.push(...COMPARISON_OPERATORS.map((op) => createOperatorCompletion(op, monaco)));
  }

  // Suggest tables when after FROM/JOIN/INTO keywords
  if (cursorContext.type === "from_keyword" || cursorContext.type === "table_after_from") {
    const afterJoin = isAfterJoinKeyword(cursorContext.beforeCursor);
    const afterInto = isAfterIntoKeyword(cursorContext.beforeCursor);
    const fromTableName = cursorContext.selectedTables[0]?.table;
    const fromColumns = fromTableName
      ? (context.columns.find((c) => c.table === fromTableName)?.columns ?? [])
      : [];

    suggestions.push(
      ...context.tables.map((table) => {
        let joinOpts: { joinOnInsertText?: string; joinOnDetail?: string } | undefined;
        if (afterJoin && !afterInto && fromTableName && table.name !== fromTableName) {
          const joinColumns = context.columns.find((c) => c.table === table.name)?.columns ?? [];
          const snippet = buildJoinOnSnippet({
            fromTable: fromTableName,
            joinTable: table.name,
            fromColumns,
            joinColumns,
            fromAlias: cursorContext.tableAliases[fromTableName],
          });
          if (snippet) {
            joinOpts = {
              joinOnInsertText: snippet.insertText,
              joinOnDetail: snippet.detail,
            };
          }
        }
        return createTableCompletion(
          table,
          cursorContext,
          context.hasMultipleSchemas,
          monaco,
          joinOpts,
        );
      }),
    );
  }

  // After INSERT INTO table, suggest (cols) VALUES (...) snippet
  if (
    (cursorContext.type === "keyword_after_table" || cursorContext.type === "table_alias") &&
    isAfterInsertIntoTable(cursorContext.beforeCursor)
  ) {
    const insertTable = cursorContext.selectedTables.at(-1)?.table;
    if (insertTable) {
      const tableCols = context.columns.find((c) => c.table === insertTable)?.columns ?? [];
      const snippet = buildInsertValuesSnippet(tableCols);
      if (snippet) {
        suggestions.push({
          label: snippet.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: snippet.detail,
          insertText: `${snippet.insertText} `,
          sortText: `0_${snippet.label}`,
          range: undefined as any,
        });
      }
    }
  }

  // Suggest keywords and tables+columns combo on empty line
  if (cursorContext.type === "empty_line") {
    // Suggest major SQL keywords first
    const keywords = getContextualKeywords(cursorContext);
    suggestions.push(...keywords.map((kw) => createKeywordCompletion(kw, monaco)));

    // Suggest all tables
    suggestions.push(
      ...context.tables.map((table) =>
        createTableCompletion(table, cursorContext, context.hasMultipleSchemas, monaco),
      ),
    );

    // Also suggest table.column combinations
    for (const table of context.tables) {
      const tableCols = context.columns.find((c) => c.table === table.name)?.columns;
      if (tableCols && tableCols.length > 0) {
        // Limit to first 5 columns per table to avoid clutter
        for (const col of tableCols.slice(0, 5)) {
          suggestions.push(
            createColumnCompletion(col.name, table.name, cursorContext, monaco, col),
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
    cursorContext.type === "after_order_by_direction" ||
    cursorContext.type === "subquery_start" ||
    cursorContext.type === "join_table" ||
    cursorContext.type === "join_with_alias"
  ) {
    // INSERT INTO table — columns VALUES snippet above; skip SELECT-style keywords
    if (!isAfterInsertIntoTable(cursorContext.beforeCursor)) {
      const keywords = getContextualKeywords(cursorContext);
      suggestions.push(...keywords.map((kw) => createKeywordCompletion(kw, monaco)));
    }
  }

  // Suggest JOIN keyword when typing partial JOIN keywords (LEFT, RIGHT, INNER, etc.)
  if (cursorContext.type === "partial_join_keyword") {
    // Extract which partial keyword was typed
    const partialMatch = cursorContext.beforeCursor.match(/\b(LEFT|RIGHT|INNER|FULL|CROSS)\s+$/i);
    const partialKeyword = partialMatch?.[1]?.toUpperCase();

    // Suggest appropriate completions based on the partial keyword
    if (partialKeyword) {
      if (partialKeyword === "CROSS") {
        // CROSS only goes with JOIN
        suggestions.push(createKeywordCompletion("JOIN", monaco));
      } else {
        // LEFT, RIGHT, INNER, FULL can have optional OUTER or go directly to JOIN
        if (partialKeyword === "FULL") {
          suggestions.push(
            createKeywordCompletion("OUTER JOIN", monaco),
            createKeywordCompletion("JOIN", monaco),
          );
        } else if (partialKeyword === "LEFT" || partialKeyword === "RIGHT") {
          suggestions.push(
            createKeywordCompletion("OUTER JOIN", monaco),
            createKeywordCompletion("JOIN", monaco),
          );
        } else {
          // INNER
          suggestions.push(createKeywordCompletion("JOIN", monaco));
        }
      }
    }
  }

  // Suggest columns when after column-expecting keywords
  if (cursorContext.type === "column_after_keyword") {
    let selectedTableNames =
      cursorContext.selectedTables.length > 0
        ? cursorContext.selectedTables.map((t) => t.table)
        : context.tables.map((t) => t.name);

    // Special case: SELECT table. without FROM clause
    // Extract the table name from the pattern and filter to just that table
    if (cursorContext.lastKeyword === "SELECT" && cursorContext.selectedTables.length === 0) {
      const selectTableMatch = cursorContext.beforeCursor.match(
        /\bSELECT\s+(?:"([^"]+)"|(\w+))\s*\.\s*$/i,
      );
      if (selectTableMatch) {
        const tableNameFromSelect = selectTableMatch[1] || selectTableMatch[2];
        // Only use this table if it exists in our available tables
        if (context.tables.some((t) => t.name === tableNameFromSelect)) {
          selectedTableNames = [tableNameFromSelect];
        }
      }
    }

    // When multiple tables are explicitly aliased, keep columns distinct by table+alias
    // Otherwise, deduplicate columns with the same name
    const allTablesAreAliased = selectedTableNames.every((t) => cursorContext.tableAliases[t]);
    const shouldKeepAllColumns = selectedTableNames.length > 1 && allTablesAreAliased;

    // Map of either "colName" or "tableName.colName" to { tableName, metadata }
    const availableColumns = new Map<
      string,
      { tableName: string; metadata?: TableColumnMetadata }
    >();

    for (const tableName of selectedTableNames) {
      const tableMetadata = context.columns.find((c) => c.table === tableName);
      if (tableMetadata?.columns) {
        for (const col of tableMetadata.columns) {
          // Create key for uniqueness - use table.column when we need to keep all columns
          const key = shouldKeepAllColumns ? `${tableName}.${col.name}` : col.name;
          // Track which table this column came from and its metadata
          if (!availableColumns.has(key)) {
            availableColumns.set(key, { tableName, metadata: col });
          }
        }
      }
    }

    suggestions.push(
      ...Array.from(availableColumns.entries()).map(([_key, { tableName, metadata }]) => {
        // Extract column name from key (either "col" or "table.col")
        const colName = shouldKeepAllColumns ? _key.split(".")[1] : _key;
        // Use alias if available, otherwise use table name
        const tableRefName = cursorContext.tableAliases[tableName] ?? tableName;
        return createColumnCompletion(colName, tableRefName, cursorContext, monaco, metadata);
      }),
    );

    // Also suggest SELECT column aliases when present in the query text
    const selectMatch = input.fullText.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch?.[1]) {
      for (const { column, alias } of parseSelectColumnAliases(selectMatch[1])) {
        suggestions.push(createColumnAliasCompletion(alias, column, monaco));
      }
    }
  }

  // console.log("context", { cursorContext, context, suggestions });

  return suggestions;
}
