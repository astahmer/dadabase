export type InferredColumnType = "integer" | "real" | "boolean" | "text" | "null";

const INTEGER_RE = /^[+-]?\d+$/;
const REAL_RE = /^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/;
const BOOLEAN_STRINGS = new Set(["true", "false"]);

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** Infers the narrowest scalar SQL-ish type that fits every non-empty value in a column. */
export function inferColumnType(values: readonly unknown[]): InferredColumnType {
  const present = values.filter((v) => !isEmpty(v));
  if (present.length === 0) return "null";

  let allBoolean = true;
  let allInteger = true;
  let allReal = true;

  for (const value of present) {
    if (typeof value === "boolean") continue;
    if (typeof value === "string" && BOOLEAN_STRINGS.has(value.trim().toLowerCase())) continue;
    allBoolean = false;
    break;
  }
  if (allBoolean) return "boolean";

  for (const value of present) {
    if (typeof value === "number") {
      if (!Number.isInteger(value)) allInteger = false;
      continue;
    }
    if (typeof value === "string" && INTEGER_RE.test(value.trim())) continue;
    allInteger = false;
  }
  if (allInteger) return "integer";

  for (const value of present) {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) allReal = false;
      continue;
    }
    if (typeof value === "string" && REAL_RE.test(value.trim())) continue;
    allReal = false;
  }
  if (allReal) return "real";

  return "text";
}

/** Infers a type per column, given row records (from CSV or JSON import) and a column order. */
export function inferColumnTypes(
  rows: Array<Record<string, unknown>>,
  columns: readonly string[],
): Record<string, InferredColumnType> {
  const result: Record<string, InferredColumnType> = {};
  for (const column of columns) {
    result[column] = inferColumnType(rows.map((row) => row[column]));
  }
  return result;
}
