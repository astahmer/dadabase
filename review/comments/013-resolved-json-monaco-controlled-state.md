# RESOLVED — JSON row editor e2e could not drive Monaco / save stale JSON

| Field | Value |
| --- | --- |
| Status | **resolved** |
| Severity | medium |
| Introduced | JSON mode `uompqvxx` / deepened in `tuxstvww`; e2e fragility surfaced after competitor wave |
| Resolved by | `xwxxssls` — sync `setValue` into controlled `onChange` |

## Original issue

Monaco’s hidden textarea is readonly; `fill()` failed. A bare `editor.setValue` did not update React `jsonText`, so Save parsed the previous document or failed validation.

## Resolution

Hook calls `editor.setValue` + `onChangeRef.current`. Residual nit: [009](./009-json-monaco-window-hook.md) (global leak).
