CREATE TABLE `clan_revisions` (
	`revision` integer PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clan_state` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
