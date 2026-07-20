/**
 * Pure helpers for detach/unlink SQL editor from generated table SQL.
 * When detached, the editor keeps its draft while filters/table context remain.
 */

export type EditorSyncInput = {
  /** When true, do not overwrite editor draft from generated SQL */
  editorDetached?: boolean;
};

/**
 * Whether the editor draft should be cleared/synced when generated SQL changes.
 * Attached (default): sync. Detached: keep draft.
 */
export const shouldSyncEditorFromGeneratedSql = (input: EditorSyncInput): boolean =>
  !input.editorDetached;

/** Toggle the detach flag. */
export const toggleEditorDetached = (editorDetached?: boolean): boolean => !editorDetached;
