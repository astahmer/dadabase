import { Effect } from "effect";
import { useEffect, useMemo, useRef, type RefObject } from "react";

import type { AiSchemaContext } from "#src/lib/ai/ai-types.ts";
import type { ChatContextAttachment } from "#src/lib/ai/chat-context.ts";
import type { ChatRuntime } from "#src/lib/chat/runtime/types.ts";
import type { KeyValueStorage } from "#src/lib/chat/runtime/types.ts";

import { getStoredByokConfig, getStoredEnabledChatTools } from "#src/lib/ai-byok.ts";
import { isProviderKeyOptional, resolveChatBaseUrl } from "#src/lib/ai/ai-providers.ts";
import { getStoredChatAccessMode } from "#src/lib/ai/chat-access-mode.ts";
import { sanitizeChatContextAttachments } from "#src/lib/ai/chat-context.ts";
import { recordCurrentChatConversationId } from "#src/lib/ai/chat-conversation-current.ts";
import { getStoredChatDataAccess } from "#src/lib/ai/chat-data-access.ts";
import {
  AUTO_SCHEMA_HEADER,
  getStoredChatSchemaSelection,
  recordResolvedAutoTables,
  resolveSchemaRequestParts,
} from "#src/lib/ai/chat-schema-selection.ts";
import { defaultGenericChatSettings } from "#src/lib/chat/chat/settings.ts";
import { ChatUiMessages } from "#src/lib/chat/chat/ui-messages.ts";
import { createDadabaseConversationClient } from "#src/lib/chat/dadabase/conversation-client.ts";
import { createChatRuntime } from "#src/lib/chat/runtime/create-chat-runtime.ts";

export interface UseChatRuntimeInput {
  connectionName: string;
  /** Latest schema context, sent with every chat request body. */
  schemaContextRef: RefObject<AiSchemaContext | undefined>;
  /** Ephemeral UI context; row/result values are gated before every request. */
  contextAttachmentsRef?: RefObject<readonly ChatContextAttachment[]>;
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
/** Fired by the provider settings panel after saving/clearing BYOK config. */
export const BYOK_CHANGED_EVENT = "dadabase:byok-changed";

const localStorageStore = (keyPrefix: string): KeyValueStorage => ({
  get: (key) => globalThis.localStorage.getItem(`${keyPrefix}:${key}`),
  set: (key, value) => globalThis.localStorage.setItem(`${keyPrefix}:${key}`, value),
  remove: (key) => globalThis.localStorage.removeItem(`${keyPrefix}:${key}`),
});

/**
 * Exact localStorage key the vendored runtime persists the composer draft
 * under (audit S6): `createChatRuntime` composes `storage.drafts` (the store
 * below) with its default `draftStorageKey` (`<settingsKey>:draft`, and the
 * settings key is left at the emi-core default), so the final key is this
 * composition. Keep in sync if `storage.keys` is ever passed explicitly.
 */
export const chatComposerDraftStorageKey = (connectionName: string): string =>
  `dadabase.chat.drafts.${connectionName}:emi-core-chat-settings:draft`;

export const useDadabaseChatRuntime = ({
  connectionName,
  schemaContextRef,
  contextAttachmentsRef,
  defaultModel = "gpt-4o-mini",
}: UseChatRuntimeInput): ChatRuntime => {
  const runtime = useMemo(
    () =>
      createChatRuntime({
        transport: {
          // Relative URL: resolves against the page origin at fetch time,
          // stays identical between server render and client hydration, and
          // needs no `window` access during SSR.
          baseUrl: "/api/chat",
          // Bound wrapper — a bare `globalThis.fetch` reference loses its
          // `this` when the transport actor invokes it and Chrome rejects
          // with "Illegal invocation".
          fetch: (...args) => globalThis.fetch(...args),
          streamInactivityTimeoutMilliseconds: 180_000,
          streamDecoder: (input) => {
            // Auto schema mode: the route reports its resolved table subset on
            // a response header; surface it for the UI badge.
            const resolved = input.response.headers.get(AUTO_SCHEMA_HEADER);
            if (resolved !== null) {
              try {
                const tables = JSON.parse(resolved) as unknown;
                if (Array.isArray(tables)) {
                  recordResolvedAutoTables(tables.filter((t) => typeof t === "string"));
                }
              } catch {
                // Malformed header — ignore, the UI keeps the generic auto label.
              }
            }
            // Audit S8: mirror the assigned conversation id for host UI
            // (editor back-links) without reaching into runtime internals.
            const conversationId = input.response.headers.get("x-conversation-id");
            if (conversationId !== null && conversationId !== "") {
              recordCurrentChatConversationId(conversationId, connectionName);
            }
            return Effect.tryPromise(() => ChatUiMessages.decodeStream(input));
          },
          messageEncoder: ({ messages, approvalDecision }) =>
            ChatUiMessages.toWireMessages({ messages, approvalDecision }),
          requestBody: ({ settings }) => {
            const stored = getStoredByokConfig();
            const providerId = settings.provider || stored?.providerId || "openai";
            const baseUrl = resolveChatBaseUrl({
              providerId,
              baseUrl: settings.baseUrl || stored?.baseUrl,
            });
            const { schemaContext, schemaMode } = resolveSchemaRequestParts(
              schemaContextRef.current,
              getStoredChatSchemaSelection(connectionName),
            );
            const dataAccess = getStoredChatDataAccess(connectionName);
            const accessMode = getStoredChatAccessMode(connectionName);
            const contextAttachments = sanitizeChatContextAttachments(
              contextAttachmentsRef?.current,
              dataAccess,
            );
            return {
              config: {
                providerId,
                apiKey: settings.apiKey || stored?.apiKey || "",
                model: settings.model || stored?.model || defaultModel,
                ...(baseUrl === undefined ? {} : { baseUrl }),
              },
              connectionName,
              enabledTools: getStoredEnabledChatTools(),
              dataAccess,
              accessMode,
              ...(contextAttachments.length > 0 ? { contextAttachments } : {}),
              ...(schemaContext === undefined ? {} : { schemaContext }),
              ...(schemaMode === undefined ? {} : { schemaMode }),
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
        // Audit C2: local presets (Ollama/LM Studio) are usable without a key.
        // The runtime core stays provider-agnostic — it asks this callback.
        apiKeyOptional: (settings) =>
          isProviderKeyOptional(settings.provider || getStoredByokConfig()?.providerId || "openai"),
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
    [connectionName, defaultModel, schemaContextRef, contextAttachmentsRef],
  );

  // Single lifecycle owner is ChatProvider (src/lib/chat/react-hooks.ts): it
  // starts on mount and disposes on final unmount with a StrictMode-safe
  // generation guard. Do NOT add a competing start/stop effect here — xstate
  // v5 actors cannot restart after .stop(), so a second owner bricks the
  // runtime on React 19 StrictMode remounts (dead-actor warning spam).

  // Dispose a replaced runtime (connectionName/defaultModel identity change);
  // never fires on StrictMode remounts because identity is unchanged there.
  const previousRuntimeRef = useRef<ChatRuntime | null>(null);
  useEffect(() => {
    const previous = previousRuntimeRef.current;
    if (previous !== null && previous !== runtime) previous.dispose();
    previousRuntimeRef.current = runtime;
  }, [runtime]);

  // Keep the runtime's BYOK provider config (provider/key/baseUrl/model) in
  // sync with the localStorage-backed config: once on mount, and again
  // whenever the provider settings panel saves/clears (it writes storage
  // directly, outside this hook).
  useEffect(() => {
    const sync = () => {
      const stored = getStoredByokConfig();
      const current = runtime.getState().settings;
      const patch: Partial<{ provider: string; apiKey: string; baseUrl: string; model: string }> =
        {};
      const storedProviderId = stored?.providerId ?? "openai";
      if (current.provider !== storedProviderId) patch.provider = storedProviderId;
      if (current.apiKey !== (stored?.apiKey ?? "")) patch.apiKey = stored?.apiKey ?? "";
      if (current.baseUrl !== (stored?.baseUrl ?? "")) patch.baseUrl = stored?.baseUrl ?? "";
      if (stored?.model !== undefined && current.model !== stored.model) {
        patch.model = stored.model;
      }
      if (Object.keys(patch).length > 0) runtime.actions.updateSettings({ patch });
    };
    sync();
    window.addEventListener(BYOK_CHANGED_EVENT, sync);
    return () => window.removeEventListener(BYOK_CHANGED_EVENT, sync);
  }, [runtime]);

  return runtime;
};
