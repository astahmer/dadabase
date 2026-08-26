// import { sql } from "drizzle-orm";
import type { Kyselify } from "drizzle-orm/kysely";

import * as sqlite from "drizzle-orm/sqlite-core";

import type { DatabaseDialect } from "./dialect.ts";

const primaryId = () => sqlite.text().primaryKey();
const timestamp = () => sqlite.integer({ mode: "timestamp" }).notNull().$type<number>();
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

/**
 * Custom SQL execution log - append-only log of manually executed SQL queries
 * Each execution creates a new row, allowing full history and traceability
 */
export const custom_sql_executions = sqlite.sqliteTable(
  "custom_sql_executions",
  {
    id: primaryId(), // nanoid short id
    connection_id: sqlite
      .text()
      .notNull()
      .references(() => database_connections.id),
    schema_name: sqlite.text(), // optional schema context
    table_name: sqlite.text(), // optional table context (if opened from a table tab)
    previous_id: sqlite.text(), // reference to parent execution (for edit chains)
    // Input
    sql: sqlite.text().notNull(),
    // Output
    status: sqlite.text().notNull().$type<"pending" | "success" | "error">(),
    rows_returned: sqlite.integer(), // number of rows in result set
    rows_affected: sqlite.integer(), // for INSERT/UPDATE/DELETE
    columns: json(), // JSON array of column names in result
    result_rows: json(), // JSON array of result rows (for immediate display)
    error_message: sqlite.text(), // error message if failed
    // Timing
    started_at: timestamp(),
    ended_at: sqlite.integer().$type<number>(),
    time_taken: sqlite.integer(), // in milliseconds
    created_at: timestamp(),
  },
  (self) => [
    sqlite.index("custom_sql_executions_connection_id_index").on(self.connection_id),
    sqlite.index("custom_sql_executions_status_index").on(self.status),
    sqlite.index("custom_sql_executions_started_at_index").on(self.started_at),
  ],
);

/**
 * AI chat threads — one conversation per row, scoped to a saved connection.
 */
export const chat_threads = sqlite.sqliteTable(
  "chat_threads",
  {
    id: primaryId(), // nanoid short id
    connection_id: sqlite
      .text()
      .notNull()
      .references(() => database_connections.id),
    title: sqlite.text().notNull(),
    status: sqlite.text().notNull().default("regular"), // "regular" | "archived"
    pinned: sqlite.integer({ mode: "boolean" }).notNull().default(false),
    created_at: timestamp(),
    updated_at: timestamp(),
  },
  (self) => [
    sqlite.index("chat_threads_connection_id_index").on(self.connection_id),
    sqlite.index("chat_threads_created_at_index").on(self.created_at),
  ],
);

/**
 * Chat messages — protocol parts stored as JSON; one row per message.
 */
export const chat_messages = sqlite.sqliteTable(
  "chat_messages",
  {
    id: primaryId(),
    thread_id: sqlite
      .text()
      .notNull()
      .references(() => chat_threads.id, { onDelete: "cascade" }),
    role: sqlite.text().notNull(), // MessageRole (user | assistant | system | summary | tool)
    parts: json().notNull(), // JSON array of protocol MessagePart
    model: sqlite.text(),
    usage: json(), // { promptTokens, completionTokens, totalTokens } | null
    context: json(), // Audit T1/T2: { mode, tables, tools } | null
    created_at: timestamp(),
  },
  (self) => [sqlite.index("chat_messages_thread_id_index").on(self.thread_id)],
);

export interface AppDatabaseSchema {
  database_connections: Kyselify<typeof database_connections>;
  query_logs: Kyselify<typeof query_logs>;
  query_favorites: Kyselify<typeof query_favorites>;
  custom_sql_executions: Kyselify<typeof custom_sql_executions>;
  chat_threads: Kyselify<typeof chat_threads>;
  chat_messages: Kyselify<typeof chat_messages>;
}
