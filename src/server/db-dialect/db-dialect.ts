/**
 * Database dialect definitions and capabilities
 */

export type DbDialect = "postgres" | "sqlite" | "mysql" | "mssql";

export interface DbDialectCapabilities {
	hasSchemas: boolean;
	supportsForeignKeys: boolean;
	supportsIndexes: boolean;
	supportsDefaultValues: boolean;
	supportsConstraints: boolean;
}

export interface DbDialectConfig {
	dialect: DbDialect;
	label: string;
	capabilities: DbDialectCapabilities;
}

export const DIALECT_CONFIGS: Record<DbDialect, DbDialectConfig> = {
	postgres: {
		dialect: "postgres",
		label: "PostgreSQL",
		capabilities: {
			hasSchemas: true,
			supportsForeignKeys: true,
			supportsIndexes: true,
			supportsDefaultValues: true,
			supportsConstraints: true,
		},
	},
	sqlite: {
		dialect: "sqlite",
		label: "SQLite",
		capabilities: {
			hasSchemas: false,
			supportsForeignKeys: true,
			supportsIndexes: true,
			supportsDefaultValues: true,
			supportsConstraints: true,
		},
	},
	mysql: {
		dialect: "mysql",
		label: "MySQL",
		capabilities: {
			hasSchemas: true,
			supportsForeignKeys: true,
			supportsIndexes: true,
			supportsDefaultValues: true,
			supportsConstraints: true,
		},
	},
	mssql: {
		dialect: "mssql",
		label: "MS SQL Server",
		capabilities: {
			hasSchemas: true,
			supportsForeignKeys: true,
			supportsIndexes: true,
			supportsDefaultValues: true,
			supportsConstraints: true,
		},
	},
};

/**
 * Detect database dialect from connection string
 */
export const detectDialectFromUrl = (url: string): DbDialect => {
	if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
		return "postgres";
	}
	if (url.startsWith("sqlite://") || url.startsWith("file://")) {
		return "sqlite";
	}
	if (url.startsWith("mysql://") || url.startsWith("mysql2://")) {
		return "mysql";
	}
	if (url.startsWith("mssql://") || url.startsWith("sqlserver://")) {
		return "mssql";
	}
	// Default to postgres for backwards compatibility
	return "postgres";
};
