/**
 * OpenAI-compatible chat provider presets.
 *
 * Every preset speaks the OpenAI REST dialect, so the server builds one
 * `createOpenAI({ baseURL, apiKey })` client regardless of vendor. Keys are
 * BYOK: stored in localStorage only, sent per request, never persisted
 * server-side.
 */

export interface AiProviderPreset {
  /** Stable id stored in BYOK config / chat settings (`provider`). */
  id: string;
  label: string;
  defaultBaseUrl: string;
  /** Local runtimes that work without any API key. */
  keyOptional: boolean;
}

export const CUSTOM_PROVIDER_ID = "custom";

const preset = (
  id: string,
  label: string,
  defaultBaseUrl: string,
  keyOptional = false,
): AiProviderPreset => ({ id, label, defaultBaseUrl, keyOptional });

export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  preset("openai", "OpenAI", "https://api.openai.com/v1"),
  preset("openrouter", "OpenRouter", "https://openrouter.ai/api/v1"),
  preset("groq", "Groq", "https://api.groq.com/openai/v1"),
  preset("mistral", "Mistral", "https://api.mistral.ai/v1"),
  preset("deepseek", "DeepSeek", "https://api.deepseek.com/v1"),
  preset("together", "Together", "https://api.together.xyz/v1"),
  preset("xai", "xAI (Grok)", "https://api.x.ai/v1"),
  preset("ollama-local", "Ollama (local)", "http://localhost:11434/v1", true),
  preset("lmstudio-local", "LM Studio (local)", "http://localhost:1234/v1", true),
  // Custom endpoint: user types the base URL; nothing is prefilled.
  preset(CUSTOM_PROVIDER_ID, "Custom (OpenAI-compatible)", "", true),
];

/** Look up a preset by id. `undefined` for unknown/custom-removed ids. */
export const getAiProviderPreset = (id: string | undefined | null): AiProviderPreset | undefined =>
  id == null ? undefined : AI_PROVIDER_PRESETS.find((p) => p.id === id);

/**
 * Resolve the base URL a chat request should use:
 * explicit user-entered URL wins → preset default → undefined (OpenAI SDK
 * default, i.e. api.openai.com).
 */
export const resolveChatBaseUrl = (input: {
  providerId?: string | undefined;
  baseUrl?: string | undefined;
}): string | undefined => {
  const trimmed = input.baseUrl?.trim();
  if (trimmed !== undefined && trimmed.length > 0) return trimmed;
  return getAiProviderPreset(input.providerId)?.defaultBaseUrl || undefined;
};

/** True when the provider can be used without an API key. */
export const isProviderKeyOptional = (providerId: string | undefined | null): boolean =>
  getAiProviderPreset(providerId)?.keyOptional ?? false;
