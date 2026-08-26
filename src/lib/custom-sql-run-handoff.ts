/**
 * Explicit AI-chat → SQL-editor run handoff.
 *
 * "Use this SQL" + "Run" from the AI chat page navigates to the connection
 * page with a freshly created SQL tab. The editor cannot be invoked across
 * that navigation (the runner registers in a mount effect we cannot await),
 * so the run request is staged in sessionStorage under the NEW tab id and
 * consumed exactly once by the editor when it mounts. Consume-once also
 * makes StrictMode double-effect invocations harmless.
 */
const keyFor = (tabId: string): string => `dadabase.custom-sql-run.${tabId}`;

export type StagedCustomSqlRun = {
  sql: string;
};

const storage = (): Storage | null => {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    // Some privacy modes throw on access.
    return null;
  }
};

/** Stage an auto-run for a not-yet-mounted editor tab. Idempotent per tab id. */
export const stageCustomSqlRun = (tabId: string, payload: StagedCustomSqlRun): void => {
  const store = storage();
  if (!store || !tabId) return;
  try {
    store.setItem(keyFor(tabId), JSON.stringify(payload));
  } catch {
    // Quota/private-mode failures degrade to "no auto-run", never a crash.
  }
};

/**
 * Read and delete the staged run for a tab. Returns null when nothing is
 * staged, the entry is corrupt, or it was already consumed.
 */
export const consumeStagedCustomSqlRun = (tabId: string): StagedCustomSqlRun | null => {
  const store = storage();
  if (!store || !tabId) return null;
  const key = keyFor(tabId);
  const raw = store.getItem(key);
  if (raw === null) return null;
  store.removeItem(key);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as StagedCustomSqlRun).sql === "string" &&
      (parsed as StagedCustomSqlRun).sql.trim() !== ""
    ) {
      return parsed as StagedCustomSqlRun;
    }
    return null;
  } catch {
    return null;
  }
};

/** Audit S8: where the seeded editor tab came from, for a return link. */
export type StagedChatReturn = {
  conversationId: string;
  title: string;
};

const returnKeyFor = (tabId: string): string => `dadabase.custom-sql-return.${tabId}`;

/**
 * Stage a chat-return marker for an editor tab. Unlike the run handoff this
 * is NOT consume-once: the editor renders the back-link for as long as the
 * tab lives, and the marker is cleared when the user follows it.
 */
export const stageChatReturn = (tabId: string, payload: StagedChatReturn): void => {
  const store = storage();
  if (!store || !tabId) return;
  try {
    store.setItem(returnKeyFor(tabId), JSON.stringify(payload));
  } catch {
    // Best-effort affordance — never block the navigation.
  }
};

/** Read (without consuming) the chat-return marker for a tab. */
export const peekChatReturn = (tabId: string): StagedChatReturn | null => {
  const store = storage();
  if (!store || !tabId) return null;
  const raw = store.getItem(returnKeyFor(tabId));
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as StagedChatReturn).conversationId === "string" &&
      typeof (parsed as StagedChatReturn).title === "string"
    ) {
      return parsed as StagedChatReturn;
    }
    return null;
  } catch {
    return null;
  }
};

/** Clear the chat-return marker after the user follows the back-link. */
export const clearChatReturn = (tabId: string): void => {
  const store = storage();
  if (!store || !tabId) return;
  try {
    store.removeItem(returnKeyFor(tabId));
  } catch {
    // Ignore private-mode failures.
  }
};
