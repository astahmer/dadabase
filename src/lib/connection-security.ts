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
