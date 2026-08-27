/**
 * Thin re-export wrapper kept for backwards-compatible imports.
 * Actual implementation lives in `#src/lib/data-export/`.
 */
export {
  copyToClipboard,
  exportRows,
  stringifyRows,
  type ExportOptions,
  rowsToInsertStatements,
} from "#src/lib/data-export/index.ts";
