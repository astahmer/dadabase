const SQL_TIMELINE_PREFIX = "dadabase:sql-timeline:";
const MAX_TIMELINE_ENTRIES = 30;

export type SqlExecutionTimelineEntry = {
  id: string;
  requestId?: string;
  sql: string;
  status: "success" | "error" | "cancelled";
  ranAt: number;
  timeTaken?: number;
  rowCount?: number;
  rowsAffected?: number;
  statementIndex?: number;
  totalStatements?: number;
  error?: string;
};

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getSqlExecutionTimelineKey = (connectionId: string, tabId: string) =>
  `${SQL_TIMELINE_PREFIX}${connectionId}:${tabId}`;

export const readSqlExecutionTimeline = (
  connectionId: string,
  tabId: string,
): SqlExecutionTimelineEntry[] => {
  const raw = getStorage()?.getItem(getSqlExecutionTimelineKey(connectionId, tabId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTimelineEntry).slice(0, MAX_TIMELINE_ENTRIES);
  } catch {
    return [];
  }
};

export const appendSqlExecutionTimeline = (
  connectionId: string,
  tabId: string,
  entry: SqlExecutionTimelineEntry,
) => {
  const next = [
    { ...entry, sql: entry.sql.slice(0, 8_000), error: entry.error?.slice(0, 2_000) },
    ...readSqlExecutionTimeline(connectionId, tabId),
  ].slice(0, MAX_TIMELINE_ENTRIES);
  try {
    getStorage()?.setItem(getSqlExecutionTimelineKey(connectionId, tabId), JSON.stringify(next));
  } catch {
    // Timeline is a convenience. Execution itself must never fail because storage is full.
  }
  return next;
};

export const clearSqlExecutionTimeline = (connectionId: string, tabId: string) => {
  try {
    getStorage()?.removeItem(getSqlExecutionTimelineKey(connectionId, tabId));
  } catch {
    // Storage can be unavailable in private browsing.
  }
};

const isTimelineEntry = (value: unknown): value is SqlExecutionTimelineEntry => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<SqlExecutionTimelineEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.sql === "string" &&
    (entry.status === "success" || entry.status === "error" || entry.status === "cancelled") &&
    typeof entry.ranAt === "number"
  );
};
