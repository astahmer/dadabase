import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { Schema } from "effect";

/**
 * Thin BYOK proxy: the browser sends the OpenAI key per request.
 * We never persist it — OpenAI's browser CORS blocks direct client calls.
 */
export const generateSqlTextServerFn = createServerFn({ method: "POST" })
  .validator(
    Schema.Struct({
      apiKey: Schema.String,
      prompt: Schema.String,
      model: Schema.optional(Schema.String),
    }).pipe(Schema.standardSchemaV1),
  )
  .handler(async ({ data }) => {
    const apiKey = data.apiKey.trim();
    if (!apiKey) {
      throw new Error("OpenAI API key is required.");
    }
    if (!data.prompt.trim()) {
      throw new Error("Prompt is empty.");
    }

    const openai = createOpenAI({ apiKey });
    const { text } = await generateText({
      model: openai(data.model ?? "gpt-4o-mini"),
      prompt: data.prompt,
    });

    return { text };
  });
