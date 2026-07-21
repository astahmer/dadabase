# Cascade delete preview is structural only (no dependent row counts)

| Field | Value |
| --- | --- |
| Status | **open** |
| Severity | medium |
| Introduced | `umkmroky` / `xvmpmoqq`; partially mitigated by `wnslvszo` |
| Relevant files | `src/lib/cascade-delete-preview.ts`, `src/components/pages/connection-page/cascade-delete-confirm.dialog.tsx` |

## Summary

`buildCascadeDeletePreview` walks FK topology and labels RESTRICT/NO ACTION edges. It does **not** query whether dependent rows exist for the selected keys. After `wnslvszo`, Delete is no longer hard-disabled (good), but the dialog can still scare or mislead (“blocked by posts”) when deleting a parent with zero children.

## Suggested fix

Optional follow-up: for each restrict/cascade edge, run a cheap `EXISTS` / `COUNT(*)` scoped to selected PK values and show “N child rows would be affected.” Keep structural mode as a fast fallback when counts fail.
