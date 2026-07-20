import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useEffectEvent } from "react";

import { isZenModeEnabled, setStoredZenMode, toggleZenModeValue } from "#src/lib/zen-mode.ts";

export const useZenModeEnabled = (): boolean => {
  const searchZenMode = useSearch({
    from: "/connections/$connectionName",
    select: (s) => s.zenMode,
  });
  return isZenModeEnabled(searchZenMode);
};

/** Navigate + persist zen mode (no keyboard shortcut). */
export const useZenModeActions = () => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const zenMode = useZenModeEnabled();

  const setZenMode = useEffectEvent((enabled: boolean) => {
    setStoredZenMode(enabled);
    void navigate({
      search: (prev) => ({
        ...prev,
        zenMode: enabled ? true : undefined,
      }),
      replace: true,
    });
  });

  const toggleZenMode = useEffectEvent(() => {
    setZenMode(toggleZenModeValue(zenMode));
  });

  return { zenMode, setZenMode, toggleZenMode };
};

/**
 * Full zen-mode wiring for the connection page root: storage↔URL sync + Cmd/Ctrl+.
 * Call once near the page root so the shortcut is not registered twice.
 */
export const useZenMode = () => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const searchZenMode = useSearch({
    from: "/connections/$connectionName",
    select: (s) => s.zenMode,
  });
  const { zenMode, setZenMode, toggleZenMode } = useZenModeActions();

  // Sync storage → URL when the param is absent but preference is on
  useEffect(() => {
    if (searchZenMode === undefined && isZenModeEnabled(undefined)) {
      void navigate({
        search: (prev) => ({ ...prev, zenMode: true }),
        replace: true,
      });
    }
  }, [navigate, searchZenMode]);

  // Persist whenever the URL param changes explicitly
  useEffect(() => {
    if (searchZenMode !== undefined) {
      setStoredZenMode(searchZenMode);
    }
  }, [searchZenMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key !== ".") return;

      event.preventDefault();
      toggleZenMode();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleZenMode]);

  return { zenMode, setZenMode, toggleZenMode };
};
