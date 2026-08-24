// Type-only stub for the vendored chat runtime (Phase A).
// The full AI SDK UIMessage bridge (chat/ui-messages.ts in @emi/core) lands with
// Phase B wire-up; only this type is needed by web/thread/chat-message-adapter.ts.
import type { UIMessage } from "ai";

export type ChatUiMessageRole = UIMessage["role"] | "summary";

export type ChatUiMessage = Omit<UIMessage, "role"> & { role: ChatUiMessageRole };
