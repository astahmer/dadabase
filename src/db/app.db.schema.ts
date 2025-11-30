// import { sql } from "drizzle-orm";
import type { Kyselify } from "drizzle-orm/kysely";
import * as sqlite from "drizzle-orm/sqlite-core";

const primaryId = () => sqlite.text().primaryKey();
const timestamp = () =>
	sqlite.integer({ mode: "timestamp" }).notNull().$type<number>();
// const timestampWithDefault = () =>
// 	sqlite
// 		.integer({ mode: "timestamp" })
// 		.default(sql`(unixepoch())`)
// 		.$type<number>();
// const boolean = () => sqlite.integer({ mode: "boolean" });
// const json = () => sqlite.text({ mode: "json" });

// TODO add indexes

export const database_connections = sqlite.sqliteTable("database_connections", {
	id: primaryId(),
	url: sqlite.text().notNull(),
	dialect: sqlite.text().notNull(),
	name: sqlite.text().notNull(),
	created_at: timestamp(),
	updated_at: timestamp(),
});

export const query_logs = sqlite.sqliteTable("query_logs", {
	id: primaryId(),
	connection_id: sqlite
		.text()
		.notNull()
		.references(() => database_connections.id),
	sql: sqlite.text().notNull(),
	params: sqlite.text(), // JSON stringified
	type: sqlite.text().notNull(), // QueryLogType
	schema: sqlite.text(),
	table: sqlite.text(),
	status: sqlite.text().notNull(),
	start_time: sqlite.integer().notNull().$type<number>(),
	end_time: sqlite.integer().$type<number>(),
	time_taken: sqlite.integer(),
	rows_returned: sqlite.integer(),
	rows_affected: sqlite.integer(),
	error: sqlite.text(), // JSON stringified error
	created_at: timestamp(),
});

// TODO drag_order (?)
export const query_favorites = sqlite.sqliteTable("query_favorites", {
	id: primaryId(),
	connection_id: sqlite
		.text()
		.notNull()
		.references(() => database_connections.id),
	label: sqlite.text().notNull(),
	sql: sqlite.text().notNull(),
	description: sqlite.text(),
	created_at: timestamp(),
	updated_at: timestamp(),
});

export interface AppDatabaseSchema {
	database_connections: Kyselify<typeof database_connections>;
	query_logs: Kyselify<typeof query_logs>;
	query_favorites: Kyselify<typeof query_favorites>;
}
