CREATE TABLE `clan_presence` (
	`browser_id` text PRIMARY KEY NOT NULL,
	`last_seen` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clan_presence_last_seen_idx` ON `clan_presence` (`last_seen`);