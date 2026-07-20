const STORAGE_KEY = "dadabase.rows-per-page";
export const DEFAULT_PAGE_LIMIT = 50;
export const MIN_PAGE_LIMIT = 1;
export const MAX_PAGE_LIMIT = 1000;

const clampLimit = (value: number): number =>
  Math.min(MAX_PAGE_LIMIT, Math.max(MIN_PAGE_LIMIT, Math.floor(value)));

/**
 * Read the user's preferred page limit from localStorage.
 * Safe on the server / when storage is unavailable — returns DEFAULT_PAGE_LIMIT.
 */
export const getStoredPageLimit = (): number => {
  if (typeof window === "undefined") return DEFAULT_PAGE_LIMIT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_PAGE_LIMIT;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "number" || !Number.isFinite(parsed)) return DEFAULT_PAGE_LIMIT;
    return clampLimit(parsed);
  } catch {
    return DEFAULT_PAGE_LIMIT;
  }
};

/** Persist the preferred page limit for future tabs / sessions. */
export const setStoredPageLimit = (limit: number): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clampLimit(limit)));
  } catch {
    // ignore quota / private-mode errors
  }
};

export const PAGE_LIMIT_STORAGE_KEY = STORAGE_KEY;
