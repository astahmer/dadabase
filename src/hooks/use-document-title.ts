import { useEffect } from "react";

/**
 * Per-route document title (ux-audit-2026-08-25 G3). The root route sets the
 * static fallback "Dadabase"; pages call this with full context, e.g.
 * `${connection.name} · Tables — Dadabase`.
 */
export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    document.title = title;
  }, [title]);
};
