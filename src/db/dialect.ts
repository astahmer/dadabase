export enum DatabaseDialect {
  Postgres = "postgres",
  SQLite = "sqlite",
  LibSQL = "libsql",
  MySQL = "mysql",
}

export const getDialectDefaultSchema = (dialect: DatabaseDialect) => {
  switch (dialect) {
    case DatabaseDialect.SQLite:
    case DatabaseDialect.LibSQL:
      return "main";
    case DatabaseDialect.MySQL:
      return "";
    default:
      return "public";
  }
};

export const onDialectOrElse = <T>(
  dialect: DatabaseDialect,
  dialects: Partial<Record<DatabaseDialect, () => T>> & { orElse: () => T },
): T => {
  const handler = dialects[dialect];
  return handler ? handler() : dialects.orElse();
};
