import { CUSTOM_PROVIDER_ID, isProviderKeyOptional } from "./ai/ai-providers.ts";
import {
  normalizeEnabledChatTools,
  type ChatToolId,
} from "./ai/chat-tools.ts";

const STORAGE_KEY = "dadabase.openai-api-key";
const RECENT_MODELS_KEY = "dadabase.chat.recent-models";
const RECENT_MODELS_CAP = 8;

/** BYOK chat provider config — stored in localStorage only. */
export interface StoredByokConfig {
  providerId: string;
  /** User-entered override; presets resolve their default when absent. */
  baseUrl?: string;
  apiKey: string;
  model?: string;
  /** Enabled chat tools; absent → all tools enabled (see chat-tools.ts). */
  enabledTools?: ChatToolId[];
}

/**
 * Read the stored BYOK config from localStorage.
 * Legacy shape (a bare JSON string key) migrates to
 * `{ providerId: "openai", apiKey }`. Safe on the server / when storage is
 * unavailable — returns null. Never send this to our server for persistence;
 * it stays in the browser and rides per-request only.
 */
export const getStoredByokConfig = (): StoredByokConfig | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") {
      // Legacy pre-providers storage: a bare API key string. Rewrite it in the
      // current JSON shape immediately so both formats never coexist.
      const apiKey = parsed.trim();
      if (apiKey.length === 0) return null;
      const migrated: StoredByokConfig = { providerId: "openai", apiKey };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        // Quota/private-mode: keep serving the in-memory migration this session.
      }
      return migrated;
    }
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.apiKey !== "string") return null;
    const apiKey = record.apiKey.trim();
    const providerId =
      typeof record.providerId === "string" && record.providerId.length > 0
        ? record.providerId
        : "openai";
    const baseUrl =
      typeof record.baseUrl === "string" && record.baseUrl.trim().length > 0
        ? record.baseUrl.trim()
        : undefined;
    const model =
      typeof record.model === "string" && record.model.trim().length > 0
        ? record.model.trim()
        : undefined;
    const enabledTools = Array.isArray(record.enabledTools)
      ? normalizeEnabledChatTools(record.enabledTools)
      : undefined;
    if (apiKey.length === 0 && !isProviderKeyOptional(providerId)) return null;
    return { providerId, baseUrl, apiKey, model, enabledTools };
  } catch {
    return null;
  }
};

/** Persist the BYOK config in localStorage only (never our backend). */
export const setStoredByokConfig = (config: StoredByokConfig): void => {
  if (typeof window === "undefined") return;
  try {
    const trimmed = config.apiKey.trim();
    // Tool preferences are a real standalone choice (e.g. keyless Ollama user
    // toggles a tool off) — they alone keep the config object alive.
    const hasToolPrefs = Array.isArray(config.enabledTools);
    const hasContent =
      trimmed.length > 0 ||
      (config.baseUrl?.trim().length ?? 0) > 0 ||
      (config.model?.trim().length ?? 0) > 0 ||
      config.providerId !== "openai" ||
      hasToolPrefs;
    if (!hasContent && !isProviderKeyOptional(config.providerId)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const normalized: StoredByokConfig = {
      providerId: config.providerId,
      baseUrl: config.baseUrl?.trim() || undefined,
      apiKey: trimmed,
      model: config.model?.trim() || undefined,
      ...(Array.isArray(config.enabledTools)
        ? { enabledTools: normalizeEnabledChatTools(config.enabledTools) }
        : {}),
    };
    // Custom without any URL is not usable — drop it instead of storing junk.
    if (normalized.providerId === CUSTOM_PROVIDER_ID && normalized.baseUrl === undefined) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore quota / private-mode errors
  }
};

/** Remove the stored BYOK config. */
export const clearStoredByokConfig = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

// ---------------------------------------------------------------------------
// Back-compat helpers — existing call sites keep working unchanged.
// ---------------------------------------------------------------------------

/** Key of the currently-stored config (legacy call sites). Empty → null. */
export const getStoredOpenAiApiKey = (): string | null => {
  const apiKey = getStoredByokConfig()?.apiKey;
  return apiKey != null && apiKey.length > 0 ? apiKey : null;
};

/** Store just an OpenAI key while preserving the rest of the config. */
export const setStoredOpenAiApiKey = (apiKey: string): void => {
  if (typeof window === "undefined") return;
  const current = getStoredByokConfig();
  const trimmed = apiKey.trim();
  if (trimmed.length === 0 && current == null) {
    clearStoredByokConfig();
    return;
  }
  setStoredByokConfig({
    providerId: current?.providerId ?? "openai",
    baseUrl: current?.baseUrl,
    model: current?.model,
    apiKey: trimmed,
    ...(current?.enabledTools ? { enabledTools: current.enabledTools } : {}),
  });
};

export const clearStoredOpenAiApiKey = clearStoredByokConfig;

/**
 * Enabled chat tools from storage; default (nothing stored) = all tools.
 * Safe on the server.
 */
export const getStoredEnabledChatTools = (): ChatToolId[] =>
  normalizeEnabledChatTools(getStoredByokConfig()?.enabledTools);

/** Persist just the enabled-tools selection while preserving the rest. */
export const setStoredEnabledChatTools = (enabledTools: readonly string[]): void => {
  if (typeof window === "undefined") return;
  const current = getStoredByokConfig();
  setStoredByokConfig({
    providerId: current?.providerId ?? "openai",
    baseUrl: current?.baseUrl,
    apiKey: current?.apiKey ?? "",
    model: current?.model,
    ...(current?.enabledTools ? { enabledTools: current.enabledTools } : {}),
    enabledTools: normalizeEnabledChatTools(enabledTools),
  });
};

/** Persist just the chat model while preserving the rest of the config. */
export const setStoredChatModel = (model: string): void => {
  if (typeof window === "undefined") return;
  const trimmed = model.trim();
  const current = getStoredByokConfig();
  if (trimmed.length === 0 && current == null) return;
  setStoredByokConfig({
    providerId: current?.providerId ?? "openai",
    baseUrl: current?.baseUrl,
    apiKey: current?.apiKey ?? "",
    ...(current?.enabledTools ? { enabledTools: current.enabledTools } : {}),
    model: trimmed.length > 0 ? trimmed : undefined,
  });
};

/** Recently used chat models, most recent first (composer picker options). */
export const getRecentChatModels = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_MODELS_KEY);
    if (raw == null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m): m is string => typeof m === "string" && m.trim().length > 0);
  } catch {
    return [];
  }
};

/** Record a model as recently used (dedup, capped, most-recent-first). */
export const rememberChatModel = (model: string): void => {
  if (typeof window === "undefined") return;
  const trimmed = model.trim();
  if (trimmed.length === 0) return;
  try {
    const next = [trimmed, ...getRecentChatModels().filter((m) => m !== trimmed)].slice(
      0,
      RECENT_MODELS_CAP,
    );
    window.localStorage.setItem(RECENT_MODELS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private-mode errors
  }
};

/** True when a usable chat config (satisfied key requirement) is stored. */
export const hasStoredOpenAiApiKey = (): boolean => getStoredOpenAiApiKey() != null;

/** True when stored config satisfies its provider's key requirement. */
export const hasUsableByokConfig = (): boolean => getStoredByokConfig() != null;

/** Basic shape check for hosted-provider keys — does not call the network. */
export const looksLikeOpenAiApiKey = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.startsWith("sk-") && trimmed.length >= 20;
};

export const OPENAI_API_KEY_STORAGE_KEY = STORAGE_KEY;
