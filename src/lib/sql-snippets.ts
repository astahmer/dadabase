export interface SqlSnippet {
  id: string;
  name: string;
  sql: string;
}

/**
 * Audit S3: snippets can reference a table with this token; the snippets menu
 * replaces it with a schema-aware table choice at insert time.
 */
export const SNIPPET_TABLE_TOKEN = "{{table}}";
export const SNIPPET_COLUMN_TOKEN = "{{column}}";
export const SNIPPET_PARAMETER_PATTERN = /\{\{param:([a-zA-Z0-9_-]+)\}\}/g;

/** Replace every table token with `table` (identity when no token present). */
export const resolveSnippetSql = (sql: string, table: string): string =>
  sql.replaceAll(SNIPPET_TABLE_TOKEN, table || SNIPPET_TABLE_TOKEN);

/** Replace schema tokens while leaving parameters visible until insertion. */
export const resolveSnippetSchemaSql = (sql: string, table: string, column: string): string =>
  sql
    .replaceAll(SNIPPET_TABLE_TOKEN, table || SNIPPET_TABLE_TOKEN)
    .replaceAll(SNIPPET_COLUMN_TOKEN, column || SNIPPET_COLUMN_TOKEN);

export const snippetReferencesTable = (sql: string): boolean => sql.includes(SNIPPET_TABLE_TOKEN);
export const snippetReferencesColumn = (sql: string): boolean => sql.includes(SNIPPET_COLUMN_TOKEN);

const STORAGE_KEY = "dadabase.sql-snippets";

export const DEFAULT_SQL_SNIPPETS: readonly SqlSnippet[] = [
  {
    id: "default-select-star",
    name: "Browse a table",
    sql: "SELECT *\nFROM {{table}}\nLIMIT 100;",
  },
  {
    id: "default-explain-analyze",
    name: "Explain a query",
    sql: "EXPLAIN\nSELECT *\nFROM {{table}}\nLIMIT 100;",
  },
  {
    id: "default-count",
    name: "Count rows",
    sql: "SELECT COUNT(*) AS row_count\nFROM {{table}};",
  },
  {
    id: "default-column-sample",
    name: "Sample one column",
    sql: "SELECT {{column}}\nFROM {{table}}\nLIMIT 100;",
  },
];

const cloneDefaults = (): SqlSnippet[] => DEFAULT_SQL_SNIPPETS.map((s) => ({ ...s }));

const migrateBuiltInSnippets = (snippets: SqlSnippet[]): SqlSnippet[] => {
  const defaultsById = new Map(DEFAULT_SQL_SNIPPETS.map((snippet) => [snippet.id, snippet]));
  return snippets.map((snippet) => {
    const replacement = defaultsById.get(snippet.id);
    return replacement ? { ...replacement } : snippet;
  });
};

const isSqlSnippet = (value: unknown): value is SqlSnippet => {
  if (value == null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    typeof candidate.sql === "string"
  );
};

const parseSnippets = (raw: string | null): SqlSnippet[] | null => {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const snippets = parsed.filter(isSqlSnippet);
    return snippets.length === parsed.length ? snippets : null;
  } catch {
    return null;
  }
};

/**
 * Read SQL snippets from localStorage.
 * Safe on the server / when storage is unavailable — returns seeded defaults.
 */
export const getSqlSnippets = (): SqlSnippet[] => {
  if (typeof window === "undefined") return cloneDefaults();
  try {
    const parsed = parseSnippets(window.localStorage.getItem(STORAGE_KEY));
    if (parsed == null) return cloneDefaults();
    return parsed;
  } catch {
    return cloneDefaults();
  }
};

/** Persist the full snippets list. */
export const setSqlSnippets = (snippets: SqlSnippet[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
  } catch {
    // ignore quota / private-mode errors
  }
};

/** Seed defaults into storage when nothing valid is stored yet. */
export const ensureSqlSnippetsSeeded = (): SqlSnippet[] => {
  const existing = migrateBuiltInSnippets(getSqlSnippets());
  if (typeof window === "undefined") return existing;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (parseSnippets(raw) == null || JSON.stringify(existing) !== raw) {
      setSqlSnippets(existing);
    }
  } catch {
    // ignore
  }
  return existing;
};

export const addSqlSnippet = (input: { name: string; sql: string; id?: string }): SqlSnippet => {
  const snippet: SqlSnippet = {
    id: input.id ?? `snippet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim() || "Untitled",
    sql: input.sql,
  };
  const next = [...getSqlSnippets(), snippet];
  setSqlSnippets(next);
  return snippet;
};

export const updateSqlSnippet = (
  id: string,
  patch: Partial<Pick<SqlSnippet, "name" | "sql">>,
): SqlSnippet | null => {
  const snippets = getSqlSnippets();
  const index = snippets.findIndex((s) => s.id === id);
  if (index < 0) return null;
  const updated: SqlSnippet = {
    ...snippets[index],
    ...(patch.name !== undefined ? { name: patch.name.trim() || snippets[index].name } : {}),
    ...(patch.sql !== undefined ? { sql: patch.sql } : {}),
  };
  const next = [...snippets];
  next[index] = updated;
  setSqlSnippets(next);
  return updated;
};

export const deleteSqlSnippet = (id: string): boolean => {
  const snippets = getSqlSnippets();
  const next = snippets.filter((s) => s.id !== id);
  if (next.length === snippets.length) return false;
  setSqlSnippets(next);
  return true;
};

/** Restore the built-in default snippets, wiping custom ones. */
export const resetSqlSnippets = (): SqlSnippet[] => {
  const defaults = cloneDefaults();
  setSqlSnippets(defaults);
  return defaults;
};

export const SQL_SNIPPETS_STORAGE_KEY = STORAGE_KEY;
