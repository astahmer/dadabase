/**
 * Convert values returned by database drivers into the JSON value shape used
 * by the AI SDK wire protocol. Drivers commonly return Date and bigint
 * instances even though the provider-facing message schema only accepts JSON.
 */
export type JsonSafeValue =
  | null
  | string
  | number
  | boolean
  | JsonSafeValue[]
  | { [key: string]: JsonSafeValue };

export const toJsonSafeValue = (value: unknown, seen = new WeakSet<object>()): JsonSafeValue => {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafeValue(item, seen));
  }

  const result: { [key: string]: JsonSafeValue } = {};
  for (const [key, item] of Object.entries(value)) {
    // Undefined object properties are not useful to the model and are not
    // valid JSON values; null makes the missing value explicit.
    result[key] = toJsonSafeValue(item, seen);
  }
  return result;
};

