import { PgClient } from "@effect/sql-pg";
import { Effect, Layer } from "effect";
import type { DbDialect } from "./db-dialect.ts";
import { DIALECT_CONFIGS } from "./db-dialect.ts";
import {
	RemoteDatabaseConfig,
	RemoteDatabaseDialect,
	RemoteSqlClient,
} from "./remote-database.tag.ts";

/**
 * Create a layer providing SqlClient for a remote database connection
 * Currently supports PostgreSQL. Other dialects will be added later.
 */
export const makeRemoteSqlLayer = (
	connectionUrl: string,
	dialect: DbDialect,
): Layer.Layer<
	RemoteSqlClient | RemoteDatabaseDialect | RemoteDatabaseConfig,
	never,
	never
> => {
	const dialectConfig = DIALECT_CONFIGS[dialect];

	// Create the base SQL layer based on dialect
	const sqlLayer = (() => {
		switch (dialect) {
			case "postgres":
				return PgClient.layer({
					url: connectionUrl,
				}).pipe(
					Layer.map((client) =>
						Layer.mergeAll(
							Layer.succeed(RemoteSqlClient, client),
							Layer.succeed(RemoteDatabaseDialect, dialect),
							Layer.succeed(RemoteDatabaseConfig, dialectConfig),
						),
					),
				);

			case "sqlite":
			case "mysql":
			case "mssql":
				// TODO: Implement other dialects
				throw new Error(`Dialect ${dialect} not yet supported`);
		}
	})();

	return sqlLayer;
};
