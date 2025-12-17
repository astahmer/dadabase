export enum DatabaseDialect {
	Postgres = "postgres",
	SQLite = "sqlite",
	LibSQL = "libsql",
}

export const getDialectDefaultSchema = (dialect: DatabaseDialect) => {
	switch (dialect) {
		case DatabaseDialect.SQLite:
		case DatabaseDialect.LibSQL:
			return "main";
		default:
			return "public";
	}
};

export const onDialectOrElse = <T>(
	dialect: DatabaseDialect,
	dialects: Record<DatabaseDialect, () => T> & { orElse: () => T },
): T => {
	switch (dialect) {
		case DatabaseDialect.Postgres:
			return dialects.postgres();
		case DatabaseDialect.SQLite:
			return dialects.sqlite();
		case DatabaseDialect.LibSQL:
			return dialects.libsql();
		default:
			return dialects.orElse();
	}
};
