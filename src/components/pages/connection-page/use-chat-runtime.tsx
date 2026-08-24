import { useEffect, useMemo, type RefObject } from "react";

import { Effect } from "effect";

import type { AiSchemaContext } from "#src/lib/ai/ai-types.ts";

import { getStoredOpenAiApiKey } from "#src/lib/ai-byok.ts";
import { defaultGenericChatSettings } from "#src/lib/chat/chat/settings.ts";
import { ChatUiMessages } from "#src/lib/chat/chat/ui-messages.ts";
import { createDadabaseConversationClient } from "#src/lib/chat/dadabase/conversation-client.ts";
import { createChatRuntime } from "#src/lib/chat/runtime/create-chat-runtime.ts";
import type { ChatRuntime } from "#src/lib/chat/runtime/types.ts";
import type { KeyValueStorage } from "#src/lib/chat/runtime/types.ts";

const localStorageStore = (keyPrefix: string): KeyValueStorage => ({
  get: (key) => globalThis.localStorage.getItem(`${keyPrefix}:${key}`),
  set: (key, value) => globalThis.localStorage.setItem(`${keyPrefix}:${key}`, value),
  remove: (key) => globalThis.localStorage.removeItem(`${keyPrefix}:${key}`),
});

export interface UseChatRuntimeInput {
  connectionName: string;
  /** Latest schema context, sent with every chat request body. */
  schemaContextRef: RefObject<AiSchemaContext | undefined>;
  /** Default model for new settings; existing persisted settings win. */
  defaultModel?: string;
}

/**
 * Assemble the vendored chat runtime for one saved connection:
 * - transport → POST /api/chat (ai-sdk streamText SSE); the BYOK key, model,
 *   connection name and schema context ride in the request body — none of them
 *   are persisted server-side;
 * - persistence → thread CRUD server fns via the dadabase ConversationClient;
 * - approvals → `approveToolCall` re-sends history with the armed decision.
 */
export const useDadabaseChatRuntime = ({
  connectionName,
  schemaContextRef,
  defaultModel = "gpt-4o-mini",
}: UseChatRuntimeInput): ChatRuntime => {
  const runtime = useMemo(
    () =>
      createChatRuntime({
        transport: {
          baseUrl: `${globalThis.location.origin}/api/chat`,
          fetch: globalThis.fetch,
          streamInactivityTimeoutMilliseconds: 180_000,
          streamDecoder: (input) => Effect.tryPromise(() => ChatUiMessages.decodeStream(input)),
          messageEncoder: ({ messages, approvalDecision }) =>
            ChatUiMessages.toWireMessages({ messages, approvalDecision }),
          requestBody: ({ settings }) => {
            const apiKey = settings.apiKey || getStoredOpenAiApiKey() || "";
            return {
              config: { apiKey, model: settings.model || defaultModel },
              connectionName,
              ...(schemaContextRef.current === undefined
                ? {}
                : { schemaContext: schemaContextRef.current }),
            };
          },
        },
        persistence: createDadabaseConversationClient({ connectionName }),
        storage: {
          settings: localStorageStore(`dadabase.chat.settings.${connectionName}`),
          drafts: localStorageStore(`dadabase.chat.drafts.${connectionName}`),
        },
        browser: {
          online: globalThis.navigator.onLine,
          subscribeOnline: (listener) => {
            const onChange = () => listener(globalThis.navigator.onLine);
            globalThis.window.addEventListener("online", onChange);
            globalThis.window.addEventListener("offline", onChange);
            return () => {
              globalThis.window.removeEventListener("online", onChange);
              globalThis.window.removeEventListener("offline", onChange);
            };
          },
        },
        identity: {
          createId: () => crypto.randomUUID(),
          now: () => new Date().toISOString(),
        },
        settings: {
          defaults: {
            ...defaultGenericChatSettings,
            provider: "openai",
            apiKey: "",
            baseUrl: "",
            model: defaultModel,
            systemPrompt: "",
          },
        },
        features: {},
      }),
    // schemaContextRef is a stable ref object; its .current updates are read
    // lazily at request time so the runtime never needs re-creation.
    [connectionName, defaultModel, schemaContextRef],
  );

  useEffect(() => {
    runtime.start();
    return () => {
      runtime.stop();
    };
  }, [runtime]);

  // Keep the runtime's BYOK key in sync with the drawer's key management.
  useEffect(() => {
    const storedKey = getStoredOpenAiApiKey() ?? "";
    if (runtime.getState().settings.apiKey !== storedKey) {
      runtime.actions.updateSettings({ patch: { apiKey: storedKey } });
    }
  }, [runtime]);

  return runtime;
};
