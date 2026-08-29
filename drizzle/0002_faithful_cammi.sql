CREATE TABLE `project_baselines` (
	`project_id` text PRIMARY KEY NOT NULL,
	`pilot_started_at` text NOT NULL,
	`current_stage` text NOT NULL,
	`summary` text NOT NULL,
	`responsible_engineer` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_events_project_idx` ON `project_events` (`project_id`);