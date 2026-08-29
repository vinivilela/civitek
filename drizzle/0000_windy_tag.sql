CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`occurrence_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_events_occurrence_idx` ON `audit_events` (`occurrence_id`);--> statement-breakpoint
CREATE TABLE `evidences` (
	`id` text PRIMARY KEY NOT NULL,
	`occurrence_id` text NOT NULL,
	`type` text NOT NULL,
	`object_key` text,
	`provider_media_id` text,
	`mime_type` text,
	`sha256` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `evidences_occurrence_idx` ON `evidences` (`occurrence_id`);--> statement-breakpoint
CREATE TABLE `occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`company_id` text NOT NULL,
	`project_id` text,
	`reporter_phone` text NOT NULL,
	`reporter_name` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`location` text,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`source_message_id` text,
	`automatic_summary` text,
	`normative_reference` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occurrences_code_unique` ON `occurrences` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `occurrences_source_message_unique` ON `occurrences` (`source_message_id`);--> statement-breakpoint
CREATE INDEX `occurrences_project_idx` ON `occurrences` (`project_id`);--> statement-breakpoint
CREATE INDEX `occurrences_status_idx` ON `occurrences` (`status`);--> statement-breakpoint
CREATE TABLE `phone_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_e164` text NOT NULL,
	`worker_name` text NOT NULL,
	`project_id` text NOT NULL,
	`active` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `phone_assignments_phone_unique` ON `phone_assignments` (`phone_e164`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_company_code_unique` ON `projects` (`company_id`,`code`);--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`occurrence_id` text,
	`phone_e164` text NOT NULL,
	`direction` text NOT NULL,
	`message_type` text NOT NULL,
	`body` text,
	`payload` text,
	`delivery_status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `whatsapp_messages_occurrence_idx` ON `whatsapp_messages` (`occurrence_id`);