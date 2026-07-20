import { createListCollection } from "@ark-ui/react/select";
import { Palette } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  EDITOR_THEME_CHANGE_EVENT,
  getStoredEditorTheme,
  listEditorThemes,
  setStoredEditorTheme,
  type EditorThemePreference,
} from "#src/lib/monaco-editor-themes.ts";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueText,
} from "../ui/select.tsx";
import { Tooltip } from "../ui/tooltip.tsx";

const themeItems = listEditorThemes().map((theme) => ({
  label: theme.label,
  value: theme.id,
}));

const themeCollection = createListCollection({ items: themeItems });

/**
 * Compact Select for Monaco editor color themes.
 * Persists preference under `dadabase.editor-theme`.
 */
export const EditorThemePicker = () => {
  const [value, setValue] = useState<EditorThemePreference>(() => getStoredEditorTheme());

  const syncFromStorage = useEffectEvent(() => {
    setValue(getStoredEditorTheme());
  });

  useEffect(() => {
    syncFromStorage();
    const onChange = () => {
      syncFromStorage();
    };
    window.addEventListener(EDITOR_THEME_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EDITOR_THEME_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const selected = useMemo(() => {
    const item = themeItems.find((t) => t.value === value);
    return item ? [item.value] : ["auto"];
  }, [value]);

  return (
    <Tooltip content="Editor theme">
      <div className="w-[148px]">
        <Select
          collection={themeCollection}
          value={selected}
          onValueChange={(details) => {
            const next = details.value[0] as EditorThemePreference | undefined;
            if (!next) return;
            setValue(next);
            setStoredEditorTheme(next);
          }}
          positioning={{ sameWidth: true }}
        >
          <SelectTrigger className="h-8 gap-1 px-2 text-xs" aria-label="Editor theme">
            <Palette className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
            <SelectValueText placeholder="Theme" className="truncate" />
          </SelectTrigger>
          <SelectContent className="z-50">
            {themeItems.map((item) => (
              <SelectItem key={item.value} item={item}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Tooltip>
  );
};
