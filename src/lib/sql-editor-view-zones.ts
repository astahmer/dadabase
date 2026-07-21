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

/** Minimal shape needed from `splitSqlStatements` results to place a per-statement zone. */
export type SqlEditorStatementLike = {
  sql: string;
  startLine: number;
};

export type PerStatementViewZoneLayout = SqlEditorViewZoneLayout & {
  /** Index of the statement within the parsed script, in source order. */
  statementIndex: number;
  /** The statement's SQL text, for wiring Run/Explain without re-parsing. */
  sql: string;
};

/** Default inline action strip shown above each individual statement. */
export const PER_STATEMENT_VIEW_ZONE_ACTIONS: readonly SqlEditorViewZoneAction[] = [
  { id: "run", label: "Run" },
  { id: "explain", label: "Explain" },
] as const;

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

/**
 * Builds one view-zone layout per statement, anchored above its first line
 * (Monaco's `afterLineNumber` is the line the zone is inserted *after*, so we
 * use `startLine - 1` to place it immediately above the statement).
 */
export const buildPerStatementViewZoneLayouts = (
  statements: readonly SqlEditorStatementLike[],
  actions: readonly SqlEditorViewZoneAction[] = PER_STATEMENT_VIEW_ZONE_ACTIONS,
): PerStatementViewZoneLayout[] =>
  statements.map((statement, statementIndex) => ({
    afterLineNumber: Math.max(0, statement.startLine - 1),
    heightInPx: 24,
    actions,
    statementIndex,
    sql: statement.sql,
  }));

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
