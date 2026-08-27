import { getErrorMessage } from "./get-error-message.ts";

/**
 * Turn a raw DB/driver error into a short, user-facing constraint message.
 */
export function formatDbError(error: unknown): string {
  const raw = getErrorMessage(error);
  const text = raw.replace(/^SqlError:\s*/i, "").trim();

  if (/\bECONNREFUSED\b/i.test(text)) {
    return "The database refused the connection. Check that it is running and reachable.";
  }
  if (/\bENOTFOUND\b/i.test(text)) {
    return "The database host could not be found. Check the hostname and network connection.";
  }
  if (/\bETIMEDOUT\b/i.test(text)) {
    return "The database connection timed out. Check the host, port, and network connection.";
  }
  if (/\bECONNRESET\b/i.test(text)) {
    return "The database connection was interrupted. Try again or check the network connection.";
  }

  const unique =
    text.match(/unique constraint "([^"]+)"/i) ||
    text.match(/UNIQUE constraint failed:\s*(.+)/i) ||
    text.match(/SQLITE_CONSTRAINT_UNIQUE:\s*UNIQUE constraint failed:\s*(.+)/i);
  if (unique) {
    return `Unique constraint violated${unique[1] ? ` (${unique[1]})` : ""}`;
  }

  const fk =
    text.match(/foreign key constraint "([^"]+)"/i) || text.match(/FOREIGN KEY constraint failed/i);
  if (fk) {
    return `Foreign key constraint violated${typeof fk[1] === "string" ? ` (${fk[1]})` : ""}`;
  }

  const notNull =
    text.match(/null value in column "([^"]+)"/i) ||
    text.match(/NOT NULL constraint failed:\s*(.+)/i);
  if (notNull) {
    return `Column "${notNull[1]}" cannot be null`;
  }

  const check = text.match(/check constraint "([^"]+)"/i);
  if (check) {
    return `Check constraint violated (${check[1]})`;
  }

  // Keep messages short for toasts
  if (text.length > 240) {
    return `${text.slice(0, 240)}…`;
  }
  return text || "Database error";
}
