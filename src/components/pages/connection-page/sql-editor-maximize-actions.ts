/** Maximize menu choices for the SQL editor toolbar */
export type SqlEditorMaximizeAction = "expand-panel" | "fullscreen";

export const SQL_EDITOR_MAXIMIZE_ACTIONS: {
  id: SqlEditorMaximizeAction;
  label: string;
  description: string;
}[] = [
  {
    id: "expand-panel",
    label: "Expand panel",
    description: "Grow the SQL panel and collapse the rows content",
  },
  {
    id: "fullscreen",
    label: "Fullscreen",
    description: "Hide sidebar and chrome; focus the editor",
  },
];
