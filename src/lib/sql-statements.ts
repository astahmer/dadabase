/**
 * Pure SQL script splitter: breaks a multi-statement script into individual statements,
 * respecting single/double-quoted strings, Postgres dollar-quoted strings (`$$...$$`,
 * `$tag$...$tag$`), and line (`--`) / block comments so semicolons inside them are not
 * treated as statement separators.
 */

export interface SqlStatement {
  /** Statement text, trimmed of surrounding whitespace, excluding the trailing `;`. */
  sql: string;
  /** 1-based line number of the first character of `sql`. */
  startLine: number;
  /** 1-based line number of the last character of `sql`. */
  endLine: number;
  /** Offset (0-based, inclusive) of the first character of `sql` in the original script. */
  startOffset: number;
  /** Offset (0-based, exclusive) right after the last character of `sql` in the original script. */
  endOffset: number;
}

function computeLineStarts(script: string): number[] {
  const starts = [0];
  for (let i = 0; i < script.length; i++) {
    if (script[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function offsetToLine(lineStarts: number[], offset: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

interface RawSegment {
  start: number;
  end: number;
  hasContent: boolean;
}

const DOLLAR_TAG_RE = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/;

function splitIntoRawSegments(script: string): RawSegment[] {
  const segments: RawSegment[] = [];
  const n = script.length;

  let segmentStart = 0;
  let hasContent = false;
  let inSingle = false;
  let inDouble = false;
  let dollarTag: string | null = null;
  let i = 0;

  const mark = (ch: string) => {
    if (!/\s/.test(ch)) hasContent = true;
  };

  while (i < n) {
    const ch = script[i]!;
    const next = script[i + 1];

    if (inSingle) {
      if (ch === "'" && next === "'") {
        hasContent = true;
        i += 2;
        continue;
      }
      if (ch === "'") {
        inSingle = false;
        i += 1;
        continue;
      }
      mark(ch);
      i += 1;
      continue;
    }

    if (inDouble) {
      if (ch === '"' && next === '"') {
        hasContent = true;
        i += 2;
        continue;
      }
      if (ch === '"') {
        inDouble = false;
        i += 1;
        continue;
      }
      mark(ch);
      i += 1;
      continue;
    }

    if (dollarTag) {
      if (script.startsWith(dollarTag, i)) {
        hasContent = true;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      mark(ch);
      i += 1;
      continue;
    }

    if (ch === "-" && next === "-") {
      while (i < n && script[i] !== "\n") i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(script[i] === "*" && script[i + 1] === "/")) i += 1;
      i = Math.min(i + 2, n);
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      hasContent = true;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      hasContent = true;
      i += 1;
      continue;
    }

    if (ch === "$") {
      const tagMatch = DOLLAR_TAG_RE.exec(script.slice(i));
      if (tagMatch) {
        dollarTag = tagMatch[0];
        hasContent = true;
        i += tagMatch[0].length;
        continue;
      }
    }

    if (ch === ";") {
      segments.push({ start: segmentStart, end: i, hasContent });
      i += 1;
      segmentStart = i;
      hasContent = false;
      continue;
    }

    mark(ch);
    i += 1;
  }

  segments.push({ start: segmentStart, end: n, hasContent });
  return segments;
}

/** Splits a SQL script into individual statements with source line/offset info. */
export function splitSqlStatements(script: string): SqlStatement[] {
  const lineStarts = computeLineStarts(script);
  const segments = splitIntoRawSegments(script);
  const statements: SqlStatement[] = [];

  for (const segment of segments) {
    if (!segment.hasContent) continue;

    const raw = script.slice(segment.start, segment.end);
    const leadingWs = raw.length - raw.replace(/^\s*/, "").length;
    const trailingWs = raw.length - raw.replace(/\s*$/, "").length;

    const startOffset = segment.start + leadingWs;
    const endOffset = segment.end - trailingWs;
    if (startOffset >= endOffset) continue;

    statements.push({
      sql: script.slice(startOffset, endOffset),
      startLine: offsetToLine(lineStarts, startOffset),
      endLine: offsetToLine(lineStarts, endOffset - 1),
      startOffset,
      endOffset,
    });
  }

  return statements;
}
