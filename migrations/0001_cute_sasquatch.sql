CREATE TABLE `query_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`label` text NOT NULL,
	`sql` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `database_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `query_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`sql` text NOT NULL,
	`params` text,
	`type` text NOT NULL,
	`schema` text,
	`table` text,
	`status` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`time_taken` integer,
	`rows_returned` integer,
	`rows_affected` integer,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `database_connections`(`id`) ON UPDATE no action ON DELETE no action
);
