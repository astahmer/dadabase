import { Context } from "effect";
import type { DbDialect, DbDialectConfig } from "./db-dialect.ts";
import type { SqlClient } from "@effect/sql";

/**
 * Provides access to the remote database SqlClient
 */
export class RemoteSqlClient extends Context.Tag("@dadabase/RemoteSqlClient")<
	RemoteSqlClient,
	SqlClient.SqlClient
>() {}

/**
 * The dialect of the currently connected remote database
 */
export class RemoteDatabaseDialect extends Context.Tag(
	"@dadabase/RemoteDatabaseDialect",
)<RemoteDatabaseDialect, DbDialect>() {}

/**
 * Configuration and capabilities for the remote database dialect
 */
export class RemoteDatabaseConfig extends Context.Tag(
	"@dadabase/RemoteDatabaseConfig",
)<RemoteDatabaseConfig, DbDialectConfig>() {}
