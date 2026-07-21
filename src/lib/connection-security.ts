/**
 * Pure helpers for connection-string security settings: SSL mode, SSH tunnel config
 * serialization, and a read-only marker. None of these touch the network; they only
 * read/write query params on a connection URL (or serialize a standalone config blob).
 */

export type SslMode = "disable" | "require" | "verify-full";

const SSL_MODES: readonly SslMode[] = ["disable", "require", "verify-full"];

/** Sets (or overwrites) the `sslmode` query param on a connection URL. Returns the URL unchanged if it can't be parsed. */
export function applySslMode(url: string, mode: SslMode): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("sslmode", mode);
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Reads the `sslmode` query param off a connection URL, if present and recognized. */
export function parseSslMode(url: string): SslMode | null {
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get("sslmode");
    return SSL_MODES.includes(mode as SslMode) ? (mode as SslMode) : null;
  } catch {
    return null;
  }
}

export interface SshTunnelConfig {
  host: string;
  port: number;
  user: string;
  privateKeyPath?: string;
}

/** Serializes an SSH tunnel config to a JSON string, meant to be stored separately from the connection URL. */
export function encodeSshTunnelConfig(config: SshTunnelConfig): string {
  return JSON.stringify(config);
}

function isValidSshTunnelConfig(value: unknown): value is SshTunnelConfig {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.host !== "string" || candidate.host === "") return false;
  if (typeof candidate.port !== "number" || !Number.isFinite(candidate.port)) return false;
  if (typeof candidate.user !== "string" || candidate.user === "") return false;
  if (candidate.privateKeyPath !== undefined && typeof candidate.privateKeyPath !== "string")
    return false;
  return true;
}

/** Parses a previously-encoded SSH tunnel config, returning `null` on invalid/malformed input. */
export function decodeSshTunnelConfig(encoded: string): SshTunnelConfig | null {
  try {
    const parsed: unknown = JSON.parse(encoded);
    if (!isValidSshTunnelConfig(parsed)) return null;
    const config: SshTunnelConfig = { host: parsed.host, port: parsed.port, user: parsed.user };
    if (parsed.privateKeyPath !== undefined) config.privateKeyPath = parsed.privateKeyPath;
    return config;
  } catch {
    return null;
  }
}

const READ_ONLY_QUERY_PARAM = "dadabase_readonly";

/** Sets or clears the `dadabase_readonly` marker query param on a connection URL. */
export function withReadOnlyFlag(url: string, readOnly: boolean): string {
  try {
    const parsed = new URL(url);
    if (readOnly) {
      parsed.searchParams.set(READ_ONLY_QUERY_PARAM, "1");
    } else {
      parsed.searchParams.delete(READ_ONLY_QUERY_PARAM);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Whether a connection URL is marked read-only via `withReadOnlyFlag`. */
export function isReadOnlyConnection(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get(READ_ONLY_QUERY_PARAM) === "1";
  } catch {
    return false;
  }
}

/**
 * Strips dadabase-only marker query params (e.g. `dadabase_readonly`) from a connection URL
 * before it's handed to the real DB driver. Some drivers (notably `@libsql/client`) throw
 * `URL_PARAM_NOT_SUPPORTED` on any query param they don't recognize, so these markers must
 * never reach `createClient`/`LibsqlClient.layer` — only our own app-level checks should see them.
 */
export function stripDadabaseMarkerParams(url: string): string {
  // Fast path: avoid round-tripping through the WHATWG URL parser (which rewrites relative
  // `file:` paths to absolute ones) for the common case of a URL with no markers at all.
  if (!url.includes("dadabase_")) return url;
  try {
    const parsed = new URL(url);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (key.startsWith("dadabase_")) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Returns an error message when a mutation must be blocked because the connection is
 * marked read-only, or `null` when the mutation is allowed to proceed.
 * Pass `isSelect: true` for read-only SQL (`SELECT`/`WITH`) run through a generic "custom SQL"
 * path — those are allowed even on a read-only connection. Omit it (or pass `false`) for
 * inherently mutating operations (insert/update/delete/schema-mutate/non-SELECT SQL).
 */
export function guardReadOnlyMutation(
  url: string,
  options: { isSelect?: boolean } = {},
): string | null {
  if (options.isSelect) return null;
  if (!isReadOnlyConnection(url)) return null;
  return "This connection is read-only. Enable write access from the connection settings to run mutations.";
}
