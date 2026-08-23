export type ConnectionLayoutPane = "sidebar" | "query-logger";

const STORAGE_PREFIX = "dadabase.connection-layout";

const storageKey = (connectionId: string, pane: ConnectionLayoutPane) =>
  `${STORAGE_PREFIX}.${connectionId}.${pane}`;

const isValidSize = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;

/** Reads a local-only panel size. Defaults are safe during SSR and private browsing. */
export const getStoredConnectionLayoutSize = (
  connectionId: string,
  pane: ConnectionLayoutPane,
  fallback: number,
): number => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(connectionId, pane));
    const value: unknown = raw === null ? undefined : JSON.parse(raw);
    return isValidSize(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

/** Persists visual workspace layout without putting it in navigation history or shared links. */
export const setStoredConnectionLayoutSize = (
  connectionId: string,
  pane: ConnectionLayoutPane,
  size: number,
): void => {
  if (typeof window === "undefined" || !isValidSize(size)) return;
  try {
    window.localStorage.setItem(storageKey(connectionId, pane), JSON.stringify(size));
  } catch {
    // Storage is optional; the current-session layout can still work without it.
  }
};
