CREATE TABLE `database_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`dialect` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
