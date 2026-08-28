export type ChatSidechatSide = "left" | "right";

export const CHAT_SIDECHAT_SIDE_STORAGE_KEY = "dadabase.ai.sidechat-side";
export const CHAT_SIDECHAT_SIDE_CHANGED_EVENT = "dadabase:ai-sidechat-side-changed";
export const CHAT_SIDECHAT_WIDTH_STORAGE_KEY = "dadabase.ai.sidechat-width";
export const CHAT_SIDECHAT_WIDTH_CHANGED_EVENT = "dadabase:ai-sidechat-width-changed";
export const CHAT_SIDECHAT_WIDTH_DEFAULT = 480;
export const CHAT_SIDECHAT_WIDTH_MIN = 320;
// Keep a generous persistence bound; the active viewport still constrains the
// drag so the panel can never make the workspace inaccessible.
export const CHAT_SIDECHAT_WIDTH_MAX = 1440;

const isSide = (value: string | null): value is ChatSidechatSide =>
  value === "left" || value === "right";

export const getStoredChatSidechatSide = (): ChatSidechatSide => {
  if (typeof window === "undefined") return "right";
  try {
    const value = window.localStorage.getItem(CHAT_SIDECHAT_SIDE_STORAGE_KEY);
    return isSide(value) ? value : "right";
  } catch {
    return "right";
  }
};

export const setStoredChatSidechatSide = (side: ChatSidechatSide): void => {
  try {
    window.localStorage.setItem(CHAT_SIDECHAT_SIDE_STORAGE_KEY, side);
    window.dispatchEvent(new Event(CHAT_SIDECHAT_SIDE_CHANGED_EVENT));
  } catch {
    // Preferences are optional; the current render still uses the selected side.
  }
};

const clampWidth = (value: number): number =>
  Math.round(Math.min(CHAT_SIDECHAT_WIDTH_MAX, Math.max(CHAT_SIDECHAT_WIDTH_MIN, value)));

export const getStoredChatSidechatWidth = (): number => {
  if (typeof window === "undefined") return CHAT_SIDECHAT_WIDTH_DEFAULT;
  try {
    const value = Number(window.localStorage.getItem(CHAT_SIDECHAT_WIDTH_STORAGE_KEY));
    return Number.isFinite(value) ? clampWidth(value) : CHAT_SIDECHAT_WIDTH_DEFAULT;
  } catch {
    return CHAT_SIDECHAT_WIDTH_DEFAULT;
  }
};

export const setStoredChatSidechatWidth = (width: number): void => {
  try {
    window.localStorage.setItem(CHAT_SIDECHAT_WIDTH_STORAGE_KEY, String(clampWidth(width)));
    window.dispatchEvent(new Event(CHAT_SIDECHAT_WIDTH_CHANGED_EVENT));
  } catch {
    // Preferences are optional; the current render still uses the selected width.
  }
};
