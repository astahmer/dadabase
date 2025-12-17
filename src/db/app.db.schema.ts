// import { sql } from "drizzle-orm";
import type { Kyselify } from "drizzle-orm/kysely";
import * as sqlite from "drizzle-orm/sqlite-core";
import type { DatabaseDialect } from "./dialect.ts";

const primaryId = () => sqlite.text().primaryKey();
const timestamp = () =>
	sqlite.integer({ mode: "timestamp" }).notNull().$type<number>();
// const timestampWithDefault = () =>
// 	sqlite
// 		.integer({ mode: "timestamp" })
// 		.default(sql`(unixepoch())`)
// 		.$type<number>();
// const boolean = () => sqlite.integer({ mode: "boolean" });
const json = () => sqlite.text();

export const database_connections = sqlite.sqliteTable(
	"database_connections",
	{
		id: primaryId(),
		dialect: sqlite.text().notNull().$type<DatabaseDialect>(),
		url: sqlite.text().unique().notNull(),
		name: sqlite.text().unique().notNull(),
		created_at: timestamp(),
		updated_at: timestamp(),
	},
	(self) => [
		sqlite.index("database_connections_url_index").on(self.url),
		sqlite.index("database_connections_dialect_index").on(self.dialect),
		sqlite.index("database_connections_name_index").on(self.name),
		sqlite.index("database_connections_created_at_index").on(self.created_at),
	],
);

export const query_logs = sqlite.sqliteTable(
	"query_logs",
	{
		id: primaryId(),
		connection_id: sqlite
			.text()
			.notNull()
			.references(() => database_connections.id),
		sql: sqlite.text().notNull(),
		params: json(),
		type: sqlite.text().notNull(), // QueryLogType
		schema: sqlite.text(),
		table: sqlite.text(),
		level: sqlite.integer().notNull(),
		status: sqlite.text().notNull(),
		start_time: sqlite.integer().notNull().$type<number>(),
		end_time: sqlite.integer().$type<number>(),
		time_taken: sqlite.integer(),
		rows_returned: sqlite.integer(),
		rows_affected: sqlite.integer(),
		error: json(),
		meta: json(),
		created_at: timestamp(),
	},
	(self) => [
		sqlite.index("query_logs_connection_id_index").on(self.connection_id),
		sqlite.index("query_logs_type_index").on(self.type),
		sqlite.index("query_logs_schema_index").on(self.schema),
		sqlite.index("query_logs_table_index").on(self.table),
		sqlite.index("query_logs_status_index").on(self.status),
	],
);

export const query_favorites = sqlite.sqliteTable(
	"query_favorites",
	{
		id: primaryId(),
		connection_id: sqlite
			.text()
			.notNull()
			.references(() => database_connections.id),
		label: sqlite.text().notNull(),
		sql: sqlite.text().notNull(),
		description: sqlite.text(),
		drag_order: sqlite.integer(),
		created_at: timestamp(),
		updated_at: timestamp(),
	},
	(self) => [
		sqlite.index("query_favorites_connection_id_index").on(self.connection_id),
		sqlite.index("query_favorites_label_index").on(self.label),
	],
);

export interface AppDatabaseSchema {
	database_connections: Kyselify<typeof database_connections>;
	query_logs: Kyselify<typeof query_logs>;
	query_favorites: Kyselify<typeof query_favorites>;
}
