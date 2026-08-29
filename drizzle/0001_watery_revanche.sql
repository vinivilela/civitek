CREATE TABLE `compliance_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`occurrence_id` text NOT NULL,
	`standard_code` text NOT NULL,
	`requirement` text NOT NULL,
	`status` text NOT NULL,
	`engineer_note` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`occurrence_id`) REFERENCES `occurrences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `compliance_checks_occurrence_idx` ON `compliance_checks` (`occurrence_id`);--> statement-breakpoint
CREATE INDEX `compliance_checks_standard_idx` ON `compliance_checks` (`standard_code`);--> statement-breakpoint
CREATE INDEX `compliance_checks_status_idx` ON `compliance_checks` (`status`);