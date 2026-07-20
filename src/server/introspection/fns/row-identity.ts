/** Hidden row identity used when a table has no primary key (sqlite rowid / pg ctid). */
export const DADABASE_ROW_ID = "__dadabase_rowid";

export function isDadabaseRowIdKey(key: string): boolean {
  return key === DADABASE_ROW_ID;
}
