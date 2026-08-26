import { DatabaseDialect } from "#src/db/dialect.ts";
import {
  applySslMode,
  withReadOnlyFlag,
  withSshTunnelConfig,
  type SslMode,
} from "#src/lib/connection-security.ts";

export interface ConnectionUrlInput {
  connectionType: DatabaseDialect;
  filePath: string;
  libsqlAuthToken: string;
  connectionUrl: string;
  readOnly: boolean;
  sslMode: SslMode | null;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPrivateKeyPath: string;
  sshPassword: string;
}

export const isValidConnectionTarget = (
  input: Pick<ConnectionUrlInput, "connectionType" | "filePath" | "connectionUrl">,
): boolean => {
  if (input.connectionType === DatabaseDialect.SQLite) return input.filePath.trim().length > 0;
  if (input.connectionType === DatabaseDialect.DuckDB) return input.filePath.trim().length > 0;
  if (input.connectionType === DatabaseDialect.Csv) return input.filePath.trim().length > 0;
  try {
    const url = new URL(input.connectionUrl);
    if (input.connectionType === DatabaseDialect.Postgres) {
      return url.protocol === "postgres:" || url.protocol === "postgresql:";
    }
    if (input.connectionType === DatabaseDialect.MySQL) return url.protocol === "mysql:";
    if (input.connectionType === DatabaseDialect.Mssql) {
      return url.protocol === "mssql:" && Boolean(url.hostname) && Boolean(url.username);
    }
    if (input.connectionType === DatabaseDialect.Clickhouse) {
      return url.protocol === "clickhouse:" && Boolean(url.hostname);
    }
    return ["libsql:", "http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

/** Scheme the URL field auto-prefixes when the user omits one, per dialect. */
const SCHEME_BY_DIALECT: Partial<Record<DatabaseDialect, string>> = {
  [DatabaseDialect.Postgres]: "postgres://",
  [DatabaseDialect.MySQL]: "mysql://",
  [DatabaseDialect.Mssql]: "mssql://",
  [DatabaseDialect.Clickhouse]: "clickhouse://",
  [DatabaseDialect.LibSQL]: "libsql://",
};

/** Schemes recognized as "already complete" (never double-prefix these). */
const KNOWN_SCHEMES = [
  "postgres://",
  "postgresql://",
  "mysql://",
  "mssql://",
  "clickhouse://",
  "libsql://",
  "http://",
  "https://",
  "file:",
];

export const getExpectedScheme = (dialect: DatabaseDialect): string | undefined =>
  SCHEME_BY_DIALECT[dialect];

/**
 * H8: explicit, dialect-correct scheme auto-prefixing. Bare `host[:port]/db`
 * input gains the expected scheme (including `libsql://`, previously mis-prefixed
 * as postgres); anything that already carries a known scheme is untouched.
 */
export const ensureUrlScheme = (dialect: DatabaseDialect, value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (KNOWN_SCHEMES.some((scheme) => trimmed.startsWith(scheme))) return trimmed;
  if (trimmed.includes("://")) return trimmed; // unknown but explicit scheme wins
  const prefix = SCHEME_BY_DIALECT[dialect];
  return prefix ? `${prefix}${trimmed}` : trimmed;
};

/** Constructs the persisted URL after all application-only safety metadata is applied. */
export const buildConnectionUrl = (values: ConnectionUrlInput): string => {
  if (values.connectionType === DatabaseDialect.SQLite) {
    const url = values.filePath.startsWith("file:") ? values.filePath : `file:${values.filePath}`;
    return withReadOnlyFlag(url, values.readOnly);
  }

  if (values.connectionType === DatabaseDialect.DuckDB) {
    // Same file-scheme convention as SQLite (`file:<path>`); survives the
    // repository's URL handling and keeps readOnly metadata support.
    const path = values.filePath.trim();
    const url = path.startsWith("file:") ? path : `file:${path}`;
    return withReadOnlyFlag(url, values.readOnly);
  }

  if (values.connectionType === DatabaseDialect.Csv) {
    // `file:<path>` where path is a .csv file OR a directory of *.csv files.
    const pathValue = values.filePath.trim();
    const url = pathValue.startsWith("file:") ? pathValue : `file:${pathValue}`;
    return withReadOnlyFlag(url, values.readOnly);
  }

  let connectionUrl = values.connectionUrl.trim();
  if (values.connectionType === DatabaseDialect.LibSQL && values.libsqlAuthToken.trim()) {
    const url = new URL(connectionUrl);
    url.searchParams.set("authToken", values.libsqlAuthToken.trim());
    connectionUrl = url.toString();
  }

  connectionUrl = withReadOnlyFlag(connectionUrl, values.readOnly);
  if (values.sslMode) connectionUrl = applySslMode(connectionUrl, values.sslMode);

  return withSshTunnelConfig(
    connectionUrl,
    values.sshHost.trim() && values.sshUser.trim()
      ? {
          host: values.sshHost.trim(),
          port: values.sshPort || 22,
          user: values.sshUser.trim(),
          privateKeyPath: values.sshPrivateKeyPath.trim() || undefined,
          password: values.sshPassword || undefined,
        }
      : null,
  );
};
