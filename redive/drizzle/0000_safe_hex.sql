CREATE TABLE `clan_admins` (
	`user_id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clan_revisions` (
	`revision` integer PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `clan_state` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`document` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text,
	`mutation_id` text NOT NULL
);
