ALTER TABLE `query_favorites` ADD `drag_order` integer;--> statement-breakpoint
CREATE INDEX `query_favorites_connection_id_index` ON `query_favorites` (`connection_id`);--> statement-breakpoint
CREATE INDEX `query_favorites_label_index` ON `query_favorites` (`label`);--> statement-breakpoint
ALTER TABLE `query_logs` ADD `level` integer NOT NULL;--> statement-breakpoint
CREATE INDEX `query_logs_connection_id_index` ON `query_logs` (`connection_id`);--> statement-breakpoint
CREATE INDEX `query_logs_type_index` ON `query_logs` (`type`);--> statement-breakpoint
CREATE INDEX `query_logs_schema_index` ON `query_logs` (`schema`);--> statement-breakpoint
CREATE INDEX `query_logs_table_index` ON `query_logs` (`table`);--> statement-breakpoint
CREATE INDEX `query_logs_status_index` ON `query_logs` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `database_connections_url_unique` ON `database_connections` (`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `database_connections_name_unique` ON `database_connections` (`name`);--> statement-breakpoint
CREATE INDEX `database_connections_url_index` ON `database_connections` (`url`);--> statement-breakpoint
CREATE INDEX `database_connections_dialect_index` ON `database_connections` (`dialect`);--> statement-breakpoint
CREATE INDEX `database_connections_name_index` ON `database_connections` (`name`);--> statement-breakpoint
CREATE INDEX `database_connections_created_at_index` ON `database_connections` (`created_at`);