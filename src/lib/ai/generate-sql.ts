import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import { getStoredOpenAiApiKey } from "#src/lib/ai-byok.ts";

import type { AiSchemaContext, AiTableContext } from "./ai-types.ts";

import { buildNlToSqlChatPrompt, extractSqlFromModelText } from "./nl-to-sql-prompt.ts";

/**
 * BYOK approach: call OpenAI from the browser with the user-provided key
 * (createOpenAI({ apiKey })). The key is read from localStorage and sent only
 * to OpenAI — never persisted on our server. Prefer this over a server fn that
 * accepts apiKey in the body (also valid, but less "pure" BYOK).
 */
export const createByokOpenAi = (apiKey: string) =>
  createOpenAI({
    apiKey,
    // Browser: key goes only to OpenAI. If CORS blocks, add a thin proxy later —
    // still never persist the key on our server.
  });

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
 * NL → SQL via OpenAI (client-side BYOK). Throws if no API key.
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

  const openai = createByokOpenAi(apiKey);
  const { text } = await generateText({
    model: openai(input.model ?? "gpt-4o-mini"),
    prompt,
  });

  return {
    sql: extractSqlFromModelText(text),
    rawText: text,
    prompt,
  };
};
