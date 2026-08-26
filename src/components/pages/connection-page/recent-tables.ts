/**
 * Recently-opened tables, per connection, for the empty-tab launcher.
 * localStorage-backed; best-effort (private mode / quota errors ignored).
 */
const KEY_PREFIX = "dadabase:recent-tables:";
const MAX_RECENTS = 5;

export type RecentTable = { schema: string; table: string };

export const getRecentTables = (connectionName: string): Array<RecentTable> => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + connectionName);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is RecentTable =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as RecentTable).schema === "string" &&
          typeof (entry as RecentTable).table === "string",
      )
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
};

export const recordRecentTable = (
  connectionName: string,
  schema: string,
  table: string,
): void => {
  if (typeof window === "undefined" || !table) return;
  try {
    const rest = getRecentTables(connectionName).filter(
      (entry) => !(entry.table === table && entry.schema === schema),
    );
    const next = [{ schema, table }, ...rest].slice(0, MAX_RECENTS);
    window.localStorage.setItem(KEY_PREFIX + connectionName, JSON.stringify(next));
  } catch {
    // ignore quota / private-mode errors
  }
};
