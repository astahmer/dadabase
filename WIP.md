I've implemented the export all functionality. Here's a summary of the changes:
1. Added TSV format support (src/components/pages/connection-page/export-rows.ts):
- Added rowsToTSV() function
- Updated ExportOptions interface to include "tsv" format
- Updated exportRows() to handle TSV export
2. Added Export All button (src/components/pages/connection-page/connection-page-status-bar.tsx):
- Added "Export All" dropdown menu in the status bar (next to refresh button)
- Shows only when there are rows and not in custom SQL mode
- Export options: JSON, CSV, TSV (file download)
- Copy options: JSON, CSV, TSV, INSERT (clipboard)
3. Implemented fetch-all logic (src/components/pages/connection.page.tsx):
- Added handleExportAll function that:
  - Fetches ALL rows from the table in pages of 1000
  - Respects current filters, sorting, joins, and column visibility
  - Supports all export formats: JSON, CSV, TSV, and COPY as INSERT
  - Shows progress toaster while fetching
  - Downloads file or copies to clipboard depending on format
The export respects:
- Current filters
- Sorting (orderBy, orderDirection, nullsOrder)
- Column visibility settings
- JOINs if configured

---

client-side JS filter in connection page

---

The implementation is complete. Here's what I added:
1. sql-query-preview.tsx:
   - Added Square icon import (stop button)
   - Added onCancel prop to the component
   - Added conditional rendering: when isLoading is true, shows a cancel button instead of run button
2. connection.page.tsx:
   - Added onCancel to useExecuteCustomSql hook that calls mutation.reset() to clear the pending state
   - Added onCancelQuery and isLoading props to RowsTableSqlEditor component
   - Passed these props through to SqlQueryPreview
When a user clicks "Run query", the button changes to a stop (square) icon. Clicking it cancels the query by resetting the mutation state.

---

