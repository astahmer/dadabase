import { useEffect, useEffectEvent, useState } from "react";

import {
  EDITOR_THEME_CHANGE_EVENT,
  getStoredEditorTheme,
  resolveEditorTheme,
  type ResolvedEditorThemeId,
} from "#src/lib/monaco-editor-themes.ts";

const isDocumentDark = (): boolean =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark");

/**
 * Resolves the active Monaco theme from stored preference + app dark mode.
 * Reacts to dark-class toggles and `setStoredEditorTheme` (same tab + storage).
 */
export const useMonacoTheme = (): ResolvedEditorThemeId => {
  // Initialize from the live document so the first editor paint already matches
  // the shell theme (avoids a light "vs" flash inside the dark workspace).
  const [theme, setTheme] = useState<ResolvedEditorThemeId>(() =>
    resolveEditorTheme(getStoredEditorTheme(), isDocumentDark()),
  );

  const refresh = useEffectEvent(() => {
    setTheme(resolveEditorTheme(getStoredEditorTheme(), isDocumentDark()));
  });

  useEffect(() => {
    refresh();

    const observer = new MutationObserver(() => {
      refresh();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onPreferenceChange = () => {
      refresh();
    };
    window.addEventListener(EDITOR_THEME_CHANGE_EVENT, onPreferenceChange);
    window.addEventListener("storage", onPreferenceChange);

    return () => {
      observer.disconnect();
      window.removeEventListener(EDITOR_THEME_CHANGE_EVENT, onPreferenceChange);
      window.removeEventListener("storage", onPreferenceChange);
    };
  }, []);

  return theme;
};
