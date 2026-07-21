export class ParseJsonRowsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseJsonRowsError";
  }
}

/**
 * Parses either a JSON array of objects (`[{...}, {...}]`) or newline-delimited JSON
 * (one JSON object per non-empty line, a.k.a. NDJSON) into an array of row objects.
 */
export function parseJsonRows(input: string): Array<Record<string, unknown>> {
  const trimmed = input.trim();
  if (trimmed === "") return [];

  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new ParseJsonRowsError(`Invalid JSON array: ${(error as Error).message}`);
    }
    if (!Array.isArray(parsed)) {
      throw new ParseJsonRowsError("Expected a JSON array of objects");
    }
    return parsed.map((item, index) => assertRowObject(item, index));
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return lines.map((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new ParseJsonRowsError(
        `Invalid JSON on line ${index + 1}: ${(error as Error).message}`,
      );
    }
    return assertRowObject(parsed, index);
  });
}

function assertRowObject(value: unknown, index: number): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ParseJsonRowsError(`Row ${index + 1} is not a JSON object`);
  }
  return value as Record<string, unknown>;
}
