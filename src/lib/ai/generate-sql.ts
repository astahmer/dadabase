import { getStoredOpenAiApiKey } from "#src/lib/ai-byok.ts";
import { generateSqlTextServerFn } from "#src/server/ai/generate-sql-text.start.ts";

import type { AiSchemaContext, AiTableContext } from "./ai-types.ts";

import { ensureSafeSelectLimit } from "./ensure-safe-select-limit.ts";
import { buildNlToSqlChatPrompt, extractSqlFromModelText } from "./nl-to-sql-prompt.ts";

export interface GenerateSqlFromNlInput {
  question: string;
  /** Full schema (preferred) */
  schema?: AiSchemaContext;
  /** @deprecated Prefer `schema` */
  table?: AiTableContext;
  /** Prior chat turns for multi-turn NL→SQL. */
  history?: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
  /** Override stored key (tests / explicit UI). */
  apiKey?: string;
  model?: string;
}

export interface GenerateSqlFromNlResult {
  sql: string;
  rawText: string;
  prompt: string;
}

/**
 * NL → SQL via OpenAI through a server proxy (BYOK).
 * The key is read from localStorage and sent only for this request — never stored server-side.
 * Direct browser → OpenAI is blocked by CORS, so the proxy is required.
 */
export const generateSqlFromNaturalLanguage = async (
  input: GenerateSqlFromNlInput,
): Promise<GenerateSqlFromNlResult> => {
  const apiKey = input.apiKey ?? getStoredOpenAiApiKey();
  if (!apiKey) {
    throw new Error("Add an OpenAI API key in AI settings (stored only in this browser).");
  }

  const prompt = buildNlToSqlChatPrompt({
    question: input.question,
    schema: input.schema,
    table: input.table,
    history: input.history,
  });

  const { text } = await generateSqlTextServerFn({
    data: {
      apiKey,
      prompt,
      model: input.model,
    },
  });

  const extracted = extractSqlFromModelText(text);
  return {
    sql: ensureSafeSelectLimit(extracted),
    rawText: text,
    prompt,
  };
};
