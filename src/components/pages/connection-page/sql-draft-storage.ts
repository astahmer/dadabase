const SQL_DRAFT_PREFIX = "dadabase:sql-draft:";
const SQL_SESSION_PREFIX = "dadabase:sql-session:";

type SqlDraftSession = {
  sessionId: string;
  startedAt: number;
  cleanExit: boolean;
};

let currentSessionId: string | undefined;

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getSqlDraftStorageKey = (connectionId: string, tabId: string) =>
  `${SQL_DRAFT_PREFIX}${connectionId}:${tabId}`;

export const readSqlDraft = (connectionId: string, tabId: string): string | null => {
  const value = getStorage()?.getItem(getSqlDraftStorageKey(connectionId, tabId));
  return value?.trim() ? value : null;
};

export const writeSqlDraft = (connectionId: string, tabId: string, sql: string) => {
  try {
    getStorage()?.setItem(getSqlDraftStorageKey(connectionId, tabId), sql);
  } catch {
    // Storage can be unavailable in private browsing or when full.
  }
};

export const clearSqlDraft = (connectionId: string, tabId: string) => {
  try {
    getStorage()?.removeItem(getSqlDraftStorageKey(connectionId, tabId));
  } catch {
    // Storage can be unavailable in private browsing.
  }
};

const getSessionId = () => {
  if (currentSessionId) return currentSessionId;
  currentSessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return currentSessionId;
};

const getSqlSessionKey = (connectionId: string, tabId: string) =>
  `${SQL_SESSION_PREFIX}${connectionId}:${tabId}`;

const readSession = (connectionId: string, tabId: string): SqlDraftSession | null => {
  const raw = getStorage()?.getItem(getSqlSessionKey(connectionId, tabId));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const session = value as Partial<SqlDraftSession>;
    if (
      typeof session.sessionId !== "string" ||
      typeof session.startedAt !== "number" ||
      typeof session.cleanExit !== "boolean"
    ) {
      return null;
    }
    return session as SqlDraftSession;
  } catch {
    return null;
  }
};

/** Starts an editor session and reports whether the previous page instance was interrupted. */
export const startSqlDraftSession = (connectionId: string, tabId: string) => {
  const previous = readSession(connectionId, tabId);
  const sessionId = getSessionId();
  try {
    getStorage()?.setItem(
      getSqlSessionKey(connectionId, tabId),
      JSON.stringify({
        sessionId,
        startedAt: Date.now(),
        cleanExit: false,
      } satisfies SqlDraftSession),
    );
  } catch {
    // Session markers are best effort and must not block editing.
  }
  return Boolean(previous && previous.sessionId !== sessionId && !previous.cleanExit);
};

/** Marks this page instance as cleanly unloaded, so the next mount is not called a crash recovery. */
export const markSqlDraftSessionCleanExit = (connectionId: string, tabId: string) => {
  const session = readSession(connectionId, tabId);
  if (!session || session.sessionId !== getSessionId()) return;
  try {
    getStorage()?.setItem(
      getSqlSessionKey(connectionId, tabId),
      JSON.stringify({ ...session, cleanExit: true }),
    );
  } catch {
    // Storage can be unavailable during page unload.
  }
};
