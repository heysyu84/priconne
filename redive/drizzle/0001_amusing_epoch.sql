CREATE TABLE `future_boss_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`refresh_after` integer NOT NULL,
	`lease_until` integer NOT NULL
);
