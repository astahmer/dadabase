# `window.__dadabaseJsonMonaco` e2e hook left on `window`

| Field | Value |
| --- | --- |
| Status | **open** |
| Severity | low |
| Introduced | `xwxxssls` (fix for JSON e2e) |
| Relevant files | `src/components/pages/connection-page/row-editor/json-monaco-editor.tsx` |

## Summary

To work around Monaco’s readonly textarea, the editor assigns a global `__dadabaseJsonMonaco.setValue` that also calls React `onChange`. Fine for Playwright, but it leaks a mutable global (last-mounted editor wins; no cleanup on unmount).

## Suggested fix

Clear the hook in a mount cleanup, or gate behind `import.meta.env.MODE === "test"` / a `data-testid` + Playwright `evaluate` that only runs in e2e builds.
