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
    return ["libsql:", "http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
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
