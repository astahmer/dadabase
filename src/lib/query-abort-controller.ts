/**
 * Helpers for cancellable client fetches via AbortController.
 *
 * Aborting cancels the browser/TanStack Start fetch and unblocks the UI.
 * It does not cancel an in-flight PostgreSQL query on the server
 * (no pg_cancel_backend wiring).
 */

/** Create a fresh controller; aborts any previous one so only one request is active. */
export function createQueryAbortController(previous?: AbortController | null): AbortController {
  previous?.abort();
  return new AbortController();
}

/** Abort if present and not already aborted. Returns whether abort() was called. */
export function abortQueryController(controller: AbortController | null | undefined): boolean {
  if (!controller || controller.signal.aborted) return false;
  controller.abort();
  return true;
}

/** True when a fetch/server-fn failed because the client aborted it. */
export function isQueryAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  if (name === "AbortError" || name === "CancelledError") return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const message = "message" in error ? String(error.message).toLowerCase() : "";
  return message.includes("aborted") || message.includes("abort");
}
