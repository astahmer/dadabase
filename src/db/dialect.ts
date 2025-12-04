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
