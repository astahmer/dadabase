/** Converts rows to pretty-printed JSON. */
export function rowsToJson(rows: Array<Record<string, unknown>>): string {
  return JSON.stringify(rows, null, 2);
}
