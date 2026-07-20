export type SqlEditorViewZoneActionId =
  | "run"
  | "explain"
  | "format"
  | "fullscreen"
  | "copy"
  | "save";

export type SqlEditorViewZoneAction = {
  id: SqlEditorViewZoneActionId;
  label: string;
};

/** Default inline action strip for Monaco `changeViewZones` above the first line. */
export const SQL_EDITOR_VIEW_ZONE_ACTIONS: readonly SqlEditorViewZoneAction[] = [
  { id: "run", label: "Run" },
  { id: "explain", label: "Explain" },
  { id: "format", label: "Format" },
  { id: "fullscreen", label: "Fullscreen" },
  { id: "copy", label: "Copy" },
  { id: "save", label: "Save" },
] as const;

export type SqlEditorViewZoneLayout = {
  afterLineNumber: number;
  heightInPx: number;
  actions: readonly SqlEditorViewZoneAction[];
};

/**
 * Layout for the SQL editor action view zone.
 * Toolbar remains primary; this zone mirrors the same actions inline.
 */
export const buildSqlEditorViewZoneLayout = (
  actions: readonly SqlEditorViewZoneAction[] = SQL_EDITOR_VIEW_ZONE_ACTIONS,
): SqlEditorViewZoneLayout => ({
  afterLineNumber: 0,
  heightInPx: 28,
  actions,
});

export const createSqlEditorViewZoneDom = (
  actions: readonly SqlEditorViewZoneAction[],
  onAction: (id: SqlEditorViewZoneActionId) => void,
  doc: Document = document,
): HTMLElement => {
  const root = doc.createElement("div");
  root.className = "dadabase-sql-view-zone";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.gap = "4px";
  root.style.padding = "0 8px";
  root.style.height = "100%";
  root.style.fontSize = "12px";
  root.style.userSelect = "none";

  for (const action of actions) {
    const button = doc.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.dataset.action = action.id;
    button.style.border = "1px solid transparent";
    button.style.background = "transparent";
    button.style.cursor = "pointer";
    button.style.padding = "2px 6px";
    button.style.borderRadius = "4px";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onAction(action.id);
    });
    root.appendChild(button);
  }

  return root;
};
