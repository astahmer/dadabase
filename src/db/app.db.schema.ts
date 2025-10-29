import { sql } from "drizzle-orm";
import type { Kyselify } from "drizzle-orm/kysely";
import * as sqlite from "drizzle-orm/sqlite-core";

const primaryId = () => sqlite.text().primaryKey();
const timestamp = () => sqlite.integer({ mode: "timestamp" });
const timestampWithDefault = () =>
	sqlite.integer({ mode: "timestamp" }).default(sql`(unixepoch())`);
const boolean = () => sqlite.integer({ mode: "boolean" });
const json = () => sqlite.text({ mode: "json" });

export const database_connections = sqlite.sqliteTable("database_connections", {
	id: primaryId(),
	url: sqlite.text().notNull(),
	dialect: sqlite.text().notNull(),
	name: sqlite.text().notNull(),
	created_at: timestampWithDefault(),
	updated_at: timestampWithDefault(),
});

export interface AppDatabaseSchema {
	database_connections: Kyselify<typeof database_connections>;
}
