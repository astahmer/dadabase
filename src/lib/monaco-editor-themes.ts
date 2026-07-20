/** localStorage key for the preferred Monaco editor theme */
export const EDITOR_THEME_STORAGE_KEY = "dadabase.editor-theme";

/** Dispatched on `window` after `setStoredEditorTheme` so same-tab listeners update */
export const EDITOR_THEME_CHANGE_EVENT = "dadabase.editor-theme-change";

/** Built-in Monaco theme ids */
export type BuiltinEditorThemeId = "vs" | "vs-dark";

/** Custom theme ids registered via `defineTheme` */
export type CustomEditorThemeId = "one-dark-pro" | "github-light" | "github-dark";

/** Stored preference — `auto` follows app light/dark mode */
export type EditorThemePreference = "auto" | BuiltinEditorThemeId | CustomEditorThemeId;

/** Resolved Monaco `theme` option (never `auto`) */
export type ResolvedEditorThemeId = BuiltinEditorThemeId | CustomEditorThemeId;

export type EditorThemeKind = "light" | "dark";

/** Subset of Monaco `IStandaloneThemeData` — no monaco-editor import (SSR-safe) */
export interface MonacoThemeData {
  base: "vs" | "vs-dark" | "hc-black";
  inherit: boolean;
  rules: Array<{
    token: string;
    foreground?: string;
    background?: string;
    fontStyle?: string;
  }>;
  colors: Record<string, string>;
}

export interface EditorThemeMeta {
  id: ResolvedEditorThemeId;
  label: string;
  kind: EditorThemeKind;
  /** Present only for custom themes that need `defineTheme` */
  data?: MonacoThemeData;
}

const ONE_DARK_PRO: MonacoThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "abb2bf" },
    { token: "comment", foreground: "5c6370", fontStyle: "italic" },
    { token: "keyword", foreground: "c678dd" },
    { token: "storage.type", foreground: "c678dd" },
    { token: "storage.modifier", foreground: "c678dd" },
    { token: "string", foreground: "98c379" },
    { token: "number", foreground: "d19a66" },
    { token: "regexp", foreground: "98c379" },
    { token: "type", foreground: "e5c07b" },
    { token: "class", foreground: "e5c07b" },
    { token: "delimiter", foreground: "abb2bf" },
    { token: "delimiter.html", foreground: "abb2bf" },
    { token: "tag", foreground: "e06c75" },
    { token: "metatag", foreground: "e06c75" },
    { token: "attribute.name", foreground: "d19a66" },
    { token: "attribute.value", foreground: "98c379" },
    { token: "variable", foreground: "e06c75" },
    { token: "variable.predefined", foreground: "e06c75" },
  ],
  colors: {
    "editor.background": "#282c34",
    "editor.foreground": "#abb2bf",
    "editor.lineHighlightBackground": "#2c313c",
    "editor.selectionBackground": "#3e4451",
    "editor.inactiveSelectionBackground": "#3a3f4b",
    "editorCursor.foreground": "#528bff",
    "editorWhitespace.foreground": "#3b4048",
    "editorIndentGuide.background": "#3b4048",
    "editorIndentGuide.activeBackground": "#c8c8c8",
    "editorLineNumber.foreground": "#495162",
    "editorLineNumber.activeForeground": "#abb2bf",
    "editorWidget.background": "#21252b",
    "editorWidget.border": "#181a1f",
    "editorSuggestWidget.background": "#21252b",
    "editorSuggestWidget.border": "#181a1f",
    "editorSuggestWidget.selectedBackground": "#2c313a",
    "list.hoverBackground": "#2c313a",
    "list.activeSelectionBackground": "#2c313a",
    "input.background": "#1d1f23",
    "dropdown.background": "#21252b",
  },
};

const GITHUB_LIGHT: MonacoThemeData = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "", foreground: "24292f" },
    { token: "comment", foreground: "6e7781", fontStyle: "italic" },
    { token: "keyword", foreground: "cf222e" },
    { token: "storage.type", foreground: "cf222e" },
    { token: "storage.modifier", foreground: "cf222e" },
    { token: "string", foreground: "0a3069" },
    { token: "number", foreground: "0550ae" },
    { token: "regexp", foreground: "0a3069" },
    { token: "type", foreground: "953800" },
    { token: "class", foreground: "953800" },
    { token: "delimiter", foreground: "24292f" },
    { token: "tag", foreground: "116329" },
    { token: "metatag", foreground: "116329" },
    { token: "attribute.name", foreground: "0550ae" },
    { token: "attribute.value", foreground: "0a3069" },
    { token: "variable", foreground: "953800" },
    { token: "variable.predefined", foreground: "0550ae" },
  ],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#24292f",
    "editor.lineHighlightBackground": "#f6f8fa",
    "editor.selectionBackground": "#0969da33",
    "editor.inactiveSelectionBackground": "#0969da22",
    "editorCursor.foreground": "#0969da",
    "editorWhitespace.foreground": "#d0d7de",
    "editorIndentGuide.background": "#d0d7de",
    "editorIndentGuide.activeBackground": "#8c959f",
    "editorLineNumber.foreground": "#8c959f",
    "editorLineNumber.activeForeground": "#24292f",
    "editorWidget.background": "#f6f8fa",
    "editorWidget.border": "#d0d7de",
    "editorSuggestWidget.background": "#ffffff",
    "editorSuggestWidget.border": "#d0d7de",
    "editorSuggestWidget.selectedBackground": "#ddf4ff",
    "list.hoverBackground": "#eaeef2",
    "list.activeSelectionBackground": "#ddf4ff",
    "input.background": "#ffffff",
    "dropdown.background": "#ffffff",
  },
};

const GITHUB_DARK: MonacoThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "e6edf3" },
    { token: "comment", foreground: "8b949e", fontStyle: "italic" },
    { token: "keyword", foreground: "ff7b72" },
    { token: "storage.type", foreground: "ff7b72" },
    { token: "storage.modifier", foreground: "ff7b72" },
    { token: "string", foreground: "a5d6ff" },
    { token: "number", foreground: "79c0ff" },
    { token: "regexp", foreground: "a5d6ff" },
    { token: "type", foreground: "ffa657" },
    { token: "class", foreground: "ffa657" },
    { token: "delimiter", foreground: "e6edf3" },
    { token: "tag", foreground: "7ee787" },
    { token: "metatag", foreground: "7ee787" },
    { token: "attribute.name", foreground: "79c0ff" },
    { token: "attribute.value", foreground: "a5d6ff" },
    { token: "variable", foreground: "ffa657" },
    { token: "variable.predefined", foreground: "79c0ff" },
  ],
  colors: {
    "editor.background": "#0d1117",
    "editor.foreground": "#e6edf3",
    "editor.lineHighlightBackground": "#161b22",
    "editor.selectionBackground": "#388bfd66",
    "editor.inactiveSelectionBackground": "#388bfd33",
    "editorCursor.foreground": "#2f81f7",
    "editorWhitespace.foreground": "#484f58",
    "editorIndentGuide.background": "#21262d",
    "editorIndentGuide.activeBackground": "#6e7681",
    "editorLineNumber.foreground": "#6e7681",
    "editorLineNumber.activeForeground": "#e6edf3",
    "editorWidget.background": "#161b22",
    "editorWidget.border": "#30363d",
    "editorSuggestWidget.background": "#161b22",
    "editorSuggestWidget.border": "#30363d",
    "editorSuggestWidget.selectedBackground": "#1f6feb33",
    "list.hoverBackground": "#1c2128",
    "list.activeSelectionBackground": "#1f6feb33",
    "input.background": "#0d1117",
    "dropdown.background": "#161b22",
  },
};

const EDITOR_THEMES: readonly EditorThemeMeta[] = [
  { id: "vs", label: "Light (VS)", kind: "light" },
  { id: "vs-dark", label: "Dark (VS)", kind: "dark" },
  { id: "one-dark-pro", label: "One Dark Pro", kind: "dark", data: ONE_DARK_PRO },
  { id: "github-light", label: "GitHub Light", kind: "light", data: GITHUB_LIGHT },
  { id: "github-dark", label: "GitHub Dark", kind: "dark", data: GITHUB_DARK },
];

const THEME_BY_ID = new Map(EDITOR_THEMES.map((theme) => [theme.id, theme]));

const VALID_PREFERENCES = new Set<string>(["auto", ...EDITOR_THEMES.map((t) => t.id)]);

/** Themes shown in the picker (includes Auto). */
export const listEditorThemes = (): Array<{
  id: EditorThemePreference;
  label: string;
  kind: EditorThemeKind | "auto";
}> => [
  { id: "auto", label: "Auto (match app)", kind: "auto" },
  ...EDITOR_THEMES.map(({ id, label, kind }) => ({ id, label, kind })),
];

/** Themes that need `monaco.editor.defineTheme`. */
export const listCustomEditorThemes = (): Array<EditorThemeMeta & { data: MonacoThemeData }> =>
  EDITOR_THEMES.filter((theme): theme is EditorThemeMeta & { data: MonacoThemeData } =>
    Boolean(theme.data),
  );

export const getEditorThemeMeta = (id: ResolvedEditorThemeId): EditorThemeMeta | undefined =>
  THEME_BY_ID.get(id);

const isEditorThemePreference = (value: unknown): value is EditorThemePreference =>
  typeof value === "string" && VALID_PREFERENCES.has(value);

/**
 * Read preferred editor theme from localStorage.
 * Safe on the server / when storage is unavailable — returns `"auto"`.
 */
export const getStoredEditorTheme = (): EditorThemePreference => {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(EDITOR_THEME_STORAGE_KEY);
    if (raw == null) return "auto";
    const parsed: unknown = JSON.parse(raw);
    if (!isEditorThemePreference(parsed)) return "auto";
    return parsed;
  } catch {
    return "auto";
  }
};

/** Persist editor theme preference for future tabs / sessions. */
export const setStoredEditorTheme = (themeId: EditorThemePreference): void => {
  if (typeof window === "undefined") return;
  if (!isEditorThemePreference(themeId)) return;
  try {
    window.localStorage.setItem(EDITOR_THEME_STORAGE_KEY, JSON.stringify(themeId));
    window.dispatchEvent(new CustomEvent(EDITOR_THEME_CHANGE_EVENT, { detail: { themeId } }));
  } catch {
    // ignore quota / private-mode errors
  }
};

/**
 * Resolve a preference to a Monaco theme id.
 * `auto` picks the built-in light/dark theme matching `isDark`.
 */
export const resolveEditorTheme = (
  themeId: EditorThemePreference,
  isDark: boolean,
): ResolvedEditorThemeId => {
  if (themeId === "auto") {
    return isDark ? "vs-dark" : "vs";
  }
  if (!THEME_BY_ID.has(themeId)) {
    return isDark ? "vs-dark" : "vs";
  }
  return themeId;
};

/** Register custom themes on a Monaco instance (idempotent). */
export const defineCustomMonacoThemes = (monaco: {
  editor: { defineTheme: (name: string, data: MonacoThemeData) => void };
}): void => {
  for (const theme of listCustomEditorThemes()) {
    monaco.editor.defineTheme(theme.id, theme.data);
  }
};
