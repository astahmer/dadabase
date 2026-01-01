CREATE TABLE `custom_sql_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`schema_name` text,
	`table_name` text,
	`sql` text NOT NULL,
	`status` text NOT NULL,
	`rows_returned` integer,
	`rows_affected` integer,
	`columns` text,
	`error_message` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`time_taken` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `database_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `custom_sql_executions_connection_id_index` ON `custom_sql_executions` (`connection_id`);--> statement-breakpoint
CREATE INDEX `custom_sql_executions_status_index` ON `custom_sql_executions` (`status`);--> statement-breakpoint
CREATE INDEX `custom_sql_executions_started_at_index` ON `custom_sql_executions` (`started_at`);--> statement-breakpoint
ALTER TABLE `query_logs` ADD `meta` text;