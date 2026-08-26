import { z } from "zod";

/**
 * BYOK provider config riding the /api/chat request body.
 * The key stays in the browser and is forwarded per request only — the server
 * never persists it. `apiKey` may be empty for key-optional local providers
 * (Ollama, LM Studio); hosted providers reject it upstream.
 */
export const ChatRequestConfigSchema = z.object({
  /** Preset id from ai-providers.ts; informational server-side. */
  providerId: z.string().min(1),
  /** OpenAI-compatible base URL. Absent → provider default (api.openai.com). */
  baseUrl: z.string().url().optional(),
  apiKey: z.string(),
  model: z.string().min(1),
});

export type ChatRequestConfig = z.infer<typeof ChatRequestConfigSchema>;
