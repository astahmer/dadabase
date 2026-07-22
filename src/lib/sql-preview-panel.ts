/** Default vertical size (%) for the SQL editor when revealing AI / custom SQL. */
export const SQL_PREVIEW_REVEAL_SIZE = 35;

/**
 * Initial splitter sizes for the SQL preview + rows content panels.
 * Collapsed by default so we don't reserve empty height above the table.
 */
export const getSqlPreviewSplitterDefaultSize = (
  sqlPreviewSize: number | undefined,
): [number, number] => {
  if (sqlPreviewSize != null && sqlPreviewSize > 0) {
    return [sqlPreviewSize, 100 - sqlPreviewSize];
  }
  return [0, 100];
};

export const isSqlPreviewOpen = (sqlPreviewSize: number | undefined): boolean =>
  (sqlPreviewSize ?? 0) > 0;
