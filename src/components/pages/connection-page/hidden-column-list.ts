export interface HiddenColumnRef {
  table: string;
  column: string;
}

/**
 * Parses a legacy string (`"col"` or `"table.col"`) or an object into a HiddenColumnRef.
 * Bare column names get `table: ""` (filled later via normalize with defaultTable).
 */
export const parseHiddenColumnString = (value: string): HiddenColumnRef => {
  const trimmed = value.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) {
    return { table: "", column: trimmed };
  }
  return {
    table: trimmed.slice(0, dot),
    column: trimmed.slice(dot + 1),
  };
};

/**
 * Normalizes mixed legacy (string) / current ({ table, column }) list entries.
 * When `defaultTable` is provided, bare columns inherit that table.
 */
export const normalizeHiddenColumnList = (input: unknown, defaultTable = ""): HiddenColumnRef[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  const result: HiddenColumnRef[] = [];

  for (const item of input) {
    if (typeof item === "string") {
      const parsed = parseHiddenColumnString(item);
      result.push({
        table: parsed.table || defaultTable,
        column: parsed.column,
      });
      continue;
    }

    if (
      item &&
      typeof item === "object" &&
      "column" in item &&
      typeof (item as { column: unknown }).column === "string"
    ) {
      const column = (item as { column: string }).column.trim();
      if (!column) continue;
      const tableRaw = (item as { table?: unknown }).table;
      const table =
        typeof tableRaw === "string" && tableRaw.trim() ? tableRaw.trim() : defaultTable;
      result.push({ table, column });
    }
  }

  return result;
};

/** Column id used by the data table / server APIs (`table.column` or bare `column`). */
export const toHiddenColumnKey = (ref: HiddenColumnRef): string =>
  ref.table ? `${ref.table}.${ref.column}` : ref.column;

export const toHiddenColumnKeys = (refs: readonly HiddenColumnRef[]): string[] =>
  refs.map(toHiddenColumnKey);

/** Build refs from data-table column ids (accessor keys). */
export const hiddenColumnRefsFromKeys = (
  keys: readonly string[],
  defaultTable = "",
): HiddenColumnRef[] =>
  keys.map((key) => {
    const parsed = parseHiddenColumnString(key);
    return {
      table: parsed.table || defaultTable,
      column: parsed.column,
    };
  });

/**
 * Whether a column id (bare or qualified) is present in the hidden list.
 * Bare refs match bare or qualified ids by column name; qualified refs require table match.
 */
export const isColumnHidden = (
  hiddenList: readonly HiddenColumnRef[],
  columnId: string,
): boolean => {
  const target = parseHiddenColumnString(columnId.trim());

  return hiddenList.some((ref) => {
    if (ref.column !== target.column) return false;
    if (!ref.table) return true;
    if (!target.table) return true;
    return ref.table === target.table;
  });
};
