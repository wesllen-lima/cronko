CREATE TABLE `heartbeats` (
	`id` text PRIMARY KEY NOT NULL,
	`monitor_id` text NOT NULL,
	`received_at` integer NOT NULL,
	`source_ip` text,
	`user_agent` text,
	`duration_ms` integer,
	`exit_code` integer,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`monitor_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`started_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `monitors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'healthy' NOT NULL,
	`expected_interval_seconds` integer NOT NULL,
	`grace_period_seconds` integer DEFAULT 300 NOT NULL,
	`paused` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monitors_slug_unique` ON `monitors` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `monitors_token_unique` ON `monitors` (`token`);--> statement-breakpoint
CREATE TABLE `notification_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL
);
