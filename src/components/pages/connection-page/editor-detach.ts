/**
 * Pure helpers for SQL editor draft vs generated table SQL.
 * Once the user has a local draft, keep it when generated SQL changes.
 * Reset clears the draft so the editor re-attaches to generated SQL.
 */

export type EditorDraftSyncInput = {
  /** True when the editor has a local draft (user edit or AI seed). */
  hasLocalDraft: boolean;
};

/**
 * Whether the editor draft should be cleared when generated SQL changes.
 * No draft → sync (display falls back to generated). Draft present → keep.
 */
export const shouldSyncEditorFromGeneratedSql = (input: EditorDraftSyncInput): boolean =>
  !input.hasLocalDraft;
