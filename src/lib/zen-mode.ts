const STORAGE_KEY = "dadabase.zen-mode";

/**
 * Read whether zen mode is preferred from localStorage.
 * Safe on the server / when storage is unavailable — returns false.
 */
export const getStoredZenMode = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return false;
    const parsed = JSON.parse(raw);
    return parsed === true;
  } catch {
    return false;
  }
};

/** Persist zen mode preference for future tabs / sessions. */
export const setStoredZenMode = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    // ignore quota / private-mode errors
  }
};

/**
 * Resolve effective zen mode from URL search param, falling back to localStorage
 * when the param is absent.
 */
export const isZenModeEnabled = (searchZenMode: boolean | undefined): boolean => {
  if (searchZenMode !== undefined) return searchZenMode;
  return getStoredZenMode();
};

/** Flip a zen-mode boolean. */
export const toggleZenModeValue = (enabled: boolean): boolean => !enabled;

export const ZEN_MODE_STORAGE_KEY = STORAGE_KEY;
