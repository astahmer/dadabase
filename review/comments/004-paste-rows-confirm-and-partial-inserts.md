# Clipboard paste uses `window.confirm` and non-atomic per-row inserts

| Field | Value |
| --- | --- |
| Status | **open** |
| Severity | medium |
| Introduced | wiring in `mnzqpkpo` / paste UX in `xvmpmoqq` (dialog commit only had cascade sheet); paste handler in `connection.page.tsx` |
| Relevant files | `src/components/pages/connection.page.tsx`, `src/lib/paste-rows.ts` |

## Summary

Paste-into-grid:

1. Blocks with native `window.confirm` (inconsistent with the rest of the UI / hard to e2e / bad a11y).
2. Inserts rows in a sequential `for` loop of `insertRowServerFn` calls with **no transaction**. A mid-batch failure leaves partial data and a generic “Paste failed” toast.

## Suggested fix

- Replace confirm with a sheet/dialog (same family as cascade delete / schema mutate).
- Prefer a single bulk-insert server function (or one transaction wrapping N inserts).
- Report `inserted/failed` counts; optionally continue-on-error with a summary.
