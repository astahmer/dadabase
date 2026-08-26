/**
 * User-facing query-history recording preference (audit S2).
 * Stored client-side; when opted out, user-authored SQL executions are sent
 * with `skipQueryLog: true` so they never reach query_logs, and the logger
 * panel shows a "recording paused" state.
 */
const STORAGE_KEY = "dadabase.query-history.optOut";

export const isQueryHistoryOptOut = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export function setQueryHistoryOptOut(optOut: boolean): void {
  try {
    if (optOut) {
      globalThis.localStorage?.setItem(STORAGE_KEY, "1");
    } else {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable (private mode etc.) — default stays "record".
  }
}

/** Spread into custom-SQL server-fn payloads to honor the preference. */
export const queryHistorySkipFlag = (): { skipQueryLog: boolean } => ({
  skipQueryLog: isQueryHistoryOptOut(),
});
