const STORAGE_KEY = "dadabase.openai-api-key";

/**
 * Read the user's OpenAI API key from localStorage (BYOK).
 * Safe on the server / when storage is unavailable — returns null.
 * Never send this key to our server for persistence; it stays in the browser.
 */
export const getStoredOpenAiApiKey = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "string") return null;
    const trimmed = parsed.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
};

/** Persist OpenAI API key in localStorage only (never our backend). */
export const setStoredOpenAiApiKey = (apiKey: string): void => {
  if (typeof window === "undefined") return;
  try {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota / private-mode errors
  }
};

/** Remove the stored OpenAI API key. */
export const clearStoredOpenAiApiKey = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

/** True when a non-empty OpenAI key is stored. */
export const hasStoredOpenAiApiKey = (): boolean => getStoredOpenAiApiKey() != null;

/** Basic shape check — does not call the network. */
export const looksLikeOpenAiApiKey = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.startsWith("sk-") && trimmed.length >= 20;
};

export const OPENAI_API_KEY_STORAGE_KEY = STORAGE_KEY;
