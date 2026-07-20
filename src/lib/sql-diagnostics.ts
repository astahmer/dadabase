/**
 * Pure SQL diagnostics analyzer for Monaco `setModelMarkers`.
 * Heuristic only: unknown tables/columns, unclosed quotes, empty statement.
 */

/** Matches Monaco `MarkerSeverity` (Hint=1, Info=2, Warning=4, Error=8). */
export const SqlDiagnosticSeverity = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
} as const;

export type SqlDiagnosticSeverity =
  (typeof SqlDiagnosticSeverity)[keyof typeof SqlDiagnosticSeverity];

export interface SqlDiagnosticMarker {
  severity: SqlDiagnosticSeverity;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface SqlDiagnosticsKnownTable {
  schema?: string;
  name: string;
}

export interface SqlDiagnosticsKnownColumn {
  name: string;
}

export interface SqlDiagnosticsKnownTableColumns {
  table: string;
  columns: SqlDiagnosticsKnownColumn[];
}

export interface SqlDiagnosticsSchema {
  tables: SqlDiagnosticsKnownTable[];
  columns: SqlDiagnosticsKnownTableColumns[];
}

const TABLE_REF_RE =
  /\b(?:FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|INTO|UPDATE|DELETE\s+FROM)\s+(?:"([^"]+)"\.|"([^"]+)"\.|(\w+)\.)?(?:"([^"]+)"|(\w+))/gi;

const TABLE_ALIAS_RE =
  /\b(?:FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN)\s+(?:"([^"]+)"\.|"([^"]+)"\.|(\w+)\.)?(?:"([^"]+)"|(\w+))(?:\s+AS\s+(\w+)|\s+(?!ON\b|WHERE\b|JOIN\b|LEFT\b|RIGHT\b|INNER\b|FULL\b|CROSS\b|GROUP\b|ORDER\b|LIMIT\b|HAVING\b|SET\b|VALUES\b|USING\b|AND\b|OR\b)(\w+))?/gi;

const SQL_KEYWORDS = new Set(
  [
    "select",
    "from",
    "where",
    "join",
    "inner",
    "left",
    "right",
    "full",
    "cross",
    "on",
    "and",
    "or",
    "group",
    "order",
    "by",
    "having",
    "limit",
    "offset",
    "as",
    "into",
    "values",
    "set",
    "update",
    "delete",
    "insert",
    "with",
    "union",
    "all",
    "distinct",
    "case",
    "when",
    "then",
    "else",
    "end",
    "null",
    "true",
    "false",
    "is",
    "not",
    "in",
    "like",
    "ilike",
    "between",
    "exists",
    "asc",
    "desc",
  ].map((k) => k.toLowerCase()),
);

export function offsetToPosition(
  sql: string,
  offset: number,
): { lineNumber: number; column: number } {
  let lineNumber = 1;
  let column = 1;
  const end = Math.max(0, Math.min(offset, sql.length));
  for (let i = 0; i < end; i++) {
    if (sql[i] === "\n") {
      lineNumber++;
      column = 1;
    } else {
      column++;
    }
  }
  return { lineNumber, column };
}

function rangeForSpan(
  sql: string,
  start: number,
  end: number,
): Omit<SqlDiagnosticMarker, "severity" | "message"> {
  const startPos = offsetToPosition(sql, start);
  const endPos = offsetToPosition(sql, end);
  return {
    startLineNumber: startPos.lineNumber,
    startColumn: startPos.column,
    endLineNumber: endPos.lineNumber,
    endColumn: endPos.column,
  };
}

function stripSqlComments(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) {
        out += sql[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < sql.length) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function isEffectivelyEmpty(sql: string): boolean {
  const stripped = stripSqlComments(sql).replace(/;/g, " ").trim();
  return stripped.length === 0;
}

function findUnclosedQuote(sql: string): { start: number; end: number } | null {
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const start = i;
      i++;
      let closed = false;
      while (i < sql.length) {
        if (quote === "'" && sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sql[i] === quote) {
          closed = true;
          i++;
          break;
        }
        i++;
      }
      if (!closed) {
        return { start, end: sql.length };
      }
      continue;
    }
    i++;
  }
  return null;
}

function normalizeIdent(raw: string): string {
  return raw.replace(/^"|"$/g, "").toLowerCase();
}

function buildKnownTableSet(tables: SqlDiagnosticsKnownTable[]): {
  byName: Set<string>;
  bySchemaName: Set<string>;
} {
  const byName = new Set<string>();
  const bySchemaName = new Set<string>();
  for (const t of tables) {
    const name = normalizeIdent(t.name);
    byName.add(name);
    if (t.schema) {
      bySchemaName.add(`${normalizeIdent(t.schema)}.${name}`);
    }
  }
  return { byName, bySchemaName };
}

function buildColumnIndex(columns: SqlDiagnosticsKnownTableColumns[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const entry of columns) {
    const table = normalizeIdent(entry.table);
    const cols = new Set(entry.columns.map((c) => normalizeIdent(c.name)));
    index.set(table, cols);
  }
  return index;
}

interface TableRef {
  schema?: string;
  table: string;
  start: number;
  end: number;
}

function extractTableRefs(sql: string): TableRef[] {
  const refs: TableRef[] = [];
  TABLE_REF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TABLE_REF_RE.exec(sql)) !== null) {
    const schema = match[1] ?? match[2] ?? match[3];
    const table = match[4] ?? match[5];
    if (!table) continue;
    // Skip SQL keywords mistaken as table names (e.g. incomplete "FROM WHERE")
    if (SQL_KEYWORDS.has(normalizeIdent(table))) continue;
    const full = match[0];
    const tableToken = schema
      ? full.slice(full.toLowerCase().lastIndexOf(schema.toLowerCase()))
      : match[4] !== undefined
        ? `"${table}"`
        : table;
    const tokenStart = match.index + full.lastIndexOf(tableToken);
    const tokenEnd = tokenStart + tableToken.length;
    refs.push({
      schema: schema ? normalizeIdent(schema) : undefined,
      table: normalizeIdent(table),
      start: tokenStart,
      end: tokenEnd,
    });
  }
  return refs;
}

interface AliasMap {
  /** alias -> table name */
  aliasToTable: Map<string, string>;
  /** ordered FROM/JOIN tables */
  tablesInScope: string[];
}

function extractAliases(sql: string): AliasMap {
  const aliasToTable = new Map<string, string>();
  const tablesInScope: string[] = [];
  TABLE_ALIAS_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TABLE_ALIAS_RE.exec(sql)) !== null) {
    const table = match[4] ?? match[5];
    if (!table || SQL_KEYWORDS.has(normalizeIdent(table))) continue;
    const tableNorm = normalizeIdent(table);
    tablesInScope.push(tableNorm);
    const explicitAlias = match[6];
    const implicitAlias = match[7];
    if (explicitAlias && !SQL_KEYWORDS.has(normalizeIdent(explicitAlias))) {
      aliasToTable.set(normalizeIdent(explicitAlias), tableNorm);
    } else if (
      implicitAlias &&
      !SQL_KEYWORDS.has(normalizeIdent(implicitAlias)) &&
      ![
        "on",
        "where",
        "join",
        "left",
        "right",
        "inner",
        "full",
        "cross",
        "using",
        "group",
        "order",
        "limit",
        "having",
        "set",
        "values",
      ].includes(normalizeIdent(implicitAlias))
    ) {
      aliasToTable.set(normalizeIdent(implicitAlias), tableNorm);
    }
    // Always allow table name as qualifier
    aliasToTable.set(tableNorm, tableNorm);
  }
  return { aliasToTable, tablesInScope };
}

function findSelectClauseRanges(
  sql: string,
): Array<{ selectStart: number; selectEnd: number; fromStart: number }> {
  const ranges: Array<{ selectStart: number; selectEnd: number; fromStart: number }> = [];
  const re = /\bSELECT\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const selectKeywordEnd = match.index + match[0].length;
    const fromMatch = /\bFROM\b/i.exec(sql.slice(selectKeywordEnd));
    if (!fromMatch) continue;
    const fromStart = selectKeywordEnd + fromMatch.index;
    ranges.push({
      selectStart: selectKeywordEnd,
      selectEnd: fromStart,
      fromStart,
    });
  }
  return ranges;
}

function splitSelectItems(selectList: string): Array<{ text: string; offset: number }> {
  const items: Array<{ text: string; offset: number }> = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let start = 0;
  for (let i = 0; i < selectList.length; i++) {
    const ch = selectList[i]!;
    if (inSingle) {
      if (ch === "'" && selectList[i + 1] === "'") {
        i++;
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (ch === "," && depth === 0) {
      items.push({ text: selectList.slice(start, i), offset: start });
      start = i + 1;
    }
  }
  items.push({ text: selectList.slice(start), offset: start });
  return items;
}

const SIMPLE_COLUMN_RE =
  /^\s*(?:"([^"]+)"|(\w+))\s*(?:\.)\s*(?:"([^"]+)"|(\w+))\s*(?:(?:AS\s+)?(?:"[^"]+"|\w+))?\s*$/i;
const UNQUALIFIED_COLUMN_RE = /^\s*(?:"([^"]+)"|(\w+))\s*(?:(?:AS\s+)?(?:"[^"]+"|\w+))?\s*$/i;

function analyzeSelectColumns(
  sql: string,
  schema: SqlDiagnosticsSchema,
  markers: SqlDiagnosticMarker[],
): void {
  if (schema.columns.length === 0) return;

  const columnIndex = buildColumnIndex(schema.columns);
  const aliases = extractAliases(sql);
  const selectRanges = findSelectClauseRanges(sql);

  for (const range of selectRanges) {
    const selectList = sql.slice(range.selectStart, range.selectEnd);
    const items = splitSelectItems(selectList);

    for (const item of items) {
      const text = item.text.trim();
      if (!text || text === "*" || /\.\*$/.test(text)) continue;
      // Skip expressions / functions
      if (/[()+*/%<>=!]/.test(text) || /\bcase\b/i.test(text)) continue;

      const absoluteOffset = range.selectStart + item.offset;
      const leadingWs = item.text.match(/^\s*/)?.[0].length ?? 0;
      const tokenStart = absoluteOffset + leadingWs;

      const qualified = SIMPLE_COLUMN_RE.exec(text);
      if (qualified) {
        const qualifier = normalizeIdent(qualified[1] ?? qualified[2] ?? "");
        const column = normalizeIdent(qualified[3] ?? qualified[4] ?? "");
        const table = aliases.aliasToTable.get(qualifier) ?? qualifier;
        const cols = columnIndex.get(table);
        // Only flag when we know the table's columns
        if (cols && !cols.has(column)) {
          const colToken = qualified[3] !== undefined ? `"${column}"` : (qualified[4] ?? column);
          const localIdx = text.toLowerCase().lastIndexOf(colToken.toLowerCase());
          const start = tokenStart + Math.max(0, localIdx);
          const end = start + colToken.length;
          markers.push({
            severity: SqlDiagnosticSeverity.Error,
            message: `Unknown column "${column}" on table "${table}"`,
            ...rangeForSpan(sql, start, end),
          });
        }
        continue;
      }

      const unqualified = UNQUALIFIED_COLUMN_RE.exec(text);
      if (!unqualified) continue;
      const column = normalizeIdent(unqualified[1] ?? unqualified[2] ?? "");
      if (!column || SQL_KEYWORDS.has(column)) continue;

      // Unambiguous: exactly one table in scope
      if (aliases.tablesInScope.length !== 1) continue;
      const table = aliases.tablesInScope[0]!;
      const cols = columnIndex.get(table);
      if (!cols) continue;
      if (!cols.has(column)) {
        const colToken = unqualified[1] !== undefined ? `"${column}"` : (unqualified[2] ?? column);
        const start = tokenStart;
        const end = start + colToken.length;
        markers.push({
          severity: SqlDiagnosticSeverity.Error,
          message: `Unknown column "${column}"`,
          ...rangeForSpan(sql, start, end),
        });
      }
    }
  }
}

/**
 * Analyze SQL text against known schema and return Monaco-compatible markers.
 */
export function analyzeSqlDiagnostics(
  sql: string,
  schema: SqlDiagnosticsSchema,
): SqlDiagnosticMarker[] {
  const markers: SqlDiagnosticMarker[] = [];

  if (isEffectivelyEmpty(sql)) {
    markers.push({
      severity: SqlDiagnosticSeverity.Warning,
      message: "Empty statement",
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: Math.max(2, offsetToPosition(sql, sql.length).column),
    });
    return markers;
  }

  const unclosed = findUnclosedQuote(sql);
  if (unclosed) {
    markers.push({
      severity: SqlDiagnosticSeverity.Error,
      message: "Unclosed string literal",
      ...rangeForSpan(sql, unclosed.start, unclosed.end),
    });
  }

  if (schema.tables.length > 0) {
    const known = buildKnownTableSet(schema.tables);
    for (const ref of extractTableRefs(sql)) {
      const ok = ref.schema
        ? known.bySchemaName.has(`${ref.schema}.${ref.table}`) || known.byName.has(ref.table)
        : known.byName.has(ref.table);
      if (!ok) {
        markers.push({
          severity: SqlDiagnosticSeverity.Error,
          message: ref.schema
            ? `Unknown table "${ref.schema}.${ref.table}"`
            : `Unknown table "${ref.table}"`,
          ...rangeForSpan(sql, ref.start, ref.end),
        });
      }
    }
  }

  analyzeSelectColumns(sql, schema, markers);

  return markers;
}
