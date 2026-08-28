const SQL_RESULT_PREFIX = "dadabase:sql-results:";
const SQL_LATEST_RESULT_SUFFIX = ":latest";
const MAX_PINNED_RESULTS = 5;
const MAX_RESULT_ROWS = 500;
const MAX_STORAGE_BYTES = 350_000;

export type StoredSqlResult = {
  id: string;
  sql: string;
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  rowsAffected?: number;
  timeTaken: number;
  ranAt: number;
  statementIndex?: number;
  totalStatements?: number;
  requestId?: string;
  pinnedAt: number;
};

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getSqlResultStorageKey = (connectionId: string, tabId: string) =>
  `${SQL_RESULT_PREFIX}${connectionId}:${tabId}`;

const getLatestSqlResultStorageKey = (connectionId: string, tabId: string) =>
  `${getSqlResultStorageKey(connectionId, tabId)}${SQL_LATEST_RESULT_SUFFIX}`;

export const readLatestSqlResult = (
  connectionId: string,
  tabId: string,
): StoredSqlResult | null => {
  const raw = getStorage()?.getItem(getLatestSqlResultStorageKey(connectionId, tabId));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isStoredSqlResult(value) ? trimStoredSqlResult(value) : null;
  } catch {
    return null;
  }
};

export const writeLatestSqlResult = (
  connectionId: string,
  tabId: string,
  result: Omit<StoredSqlResult, "pinnedAt">,
) => {
  try {
    getStorage()?.setItem(
      getLatestSqlResultStorageKey(connectionId, tabId),
      JSON.stringify(trimStoredSqlResult({ ...result, pinnedAt: Date.now() })),
    );
  } catch {
    // The live fallback is best effort; the server execution remains the source of truth.
  }
};

export const readStoredSqlResults = (connectionId: string, tabId: string): StoredSqlResult[] => {
  const raw = getStorage()?.getItem(getSqlResultStorageKey(connectionId, tabId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredSqlResult).slice(0, MAX_PINNED_RESULTS);
  } catch {
    return [];
  }
};

export const writeStoredSqlResults = (
  connectionId: string,
  tabId: string,
  results: StoredSqlResult[],
) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    let next = results.slice(0, MAX_PINNED_RESULTS).map(trimStoredSqlResult);
    while (next.length > 0 && JSON.stringify(next).length > MAX_STORAGE_BYTES) {
      next = next.slice(0, -1);
    }
    if (next.length === 0) storage.removeItem(getSqlResultStorageKey(connectionId, tabId));
    else storage.setItem(getSqlResultStorageKey(connectionId, tabId), JSON.stringify(next));
  } catch {
    // Storage can be unavailable or full. Pinned results remain available in memory.
  }
};

export const pinSqlResult = (
  connectionId: string,
  tabId: string,
  result: Omit<StoredSqlResult, "pinnedAt">,
) => {
  const existing = readStoredSqlResults(connectionId, tabId);
  const next = [
    { ...result, pinnedAt: Date.now() },
    ...existing.filter((item) => item.id !== result.id),
  ];
  writeStoredSqlResults(connectionId, tabId, next);
  return next.slice(0, MAX_PINNED_RESULTS).map(trimStoredSqlResult);
};

export const unpinSqlResult = (connectionId: string, tabId: string, id: string) => {
  const next = readStoredSqlResults(connectionId, tabId).filter((result) => result.id !== id);
  writeStoredSqlResults(connectionId, tabId, next);
  return next;
};

const isStoredSqlResult = (value: unknown): value is StoredSqlResult => {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<StoredSqlResult>;
  return (
    typeof result.id === "string" &&
    typeof result.sql === "string" &&
    Array.isArray(result.rows) &&
    Array.isArray(result.columns) &&
    typeof result.rowCount === "number" &&
    typeof result.timeTaken === "number" &&
    typeof result.ranAt === "number" &&
    typeof result.pinnedAt === "number"
  );
};

const trimStoredSqlResult = (result: StoredSqlResult): StoredSqlResult => ({
  ...result,
  sql: result.sql.slice(0, 8_000),
  rows: result.rows.slice(0, MAX_RESULT_ROWS),
  columns: result.columns.slice(0, 200),
});
