export function replaceDatabaseInConnectionUrl(connectionUrl: string, newDatabase: string) {
  try {
    const url = new URL(connectionUrl);
    url.pathname = `/${newDatabase}`;
    return url.toString();
  } catch {
    return connectionUrl;
  }
}

export function getDbNameFromConnectionUrl(connectionUrl: string) {
  try {
    const url = new URL(connectionUrl);
    const databaseName = url.pathname.replace("/", "");
    return databaseName;
  } catch {
    return "";
  }
}
