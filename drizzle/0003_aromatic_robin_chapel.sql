CREATE TABLE `ai_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`project_id` text,
	`occurrence_id` text,
	`kind` text NOT NULL,
	`tier` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`cached_input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cost_micros` integer NOT NULL,
	`accepted` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_interactions_company_idx` ON `ai_interactions` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_interactions_kind_idx` ON `ai_interactions` (`company_id`,`kind`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_slug_unique` ON `companies` (`slug`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_company_user_unique` ON `memberships` (`company_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`company_id` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`status` text NOT NULL,
	`project_quota` integer NOT NULL,
	`monthly_message_quota` integer NOT NULL,
	`memory_trial_ends_at` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tenant_profiles` (
	`company_id` text PRIMARY KEY NOT NULL,
	`project_count` integer NOT NULL,
	`occurrence_count` integer NOT NULL,
	`message_count` integer NOT NULL,
	`payload` text NOT NULL,
	`computed_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP INDEX `phone_assignments_phone_unique`;
--> statement-breakpoint
DROP INDEX `audit_events_occurrence_idx`;
--> statement-breakpoint
DROP INDEX `compliance_checks_occurrence_idx`;
--> statement-breakpoint
DROP INDEX `compliance_checks_standard_idx`;
--> statement-breakpoint
DROP INDEX `compliance_checks_status_idx`;
--> statement-breakpoint
DROP INDEX `evidences_occurrence_idx`;
--> statement-breakpoint
DROP INDEX `occurrences_project_idx`;
--> statement-breakpoint
DROP INDEX `occurrences_status_idx`;
--> statement-breakpoint
DROP INDEX `project_events_project_idx`;
--> statement-breakpoint
DROP INDEX `whatsapp_messages_occurrence_idx`;
--> statement-breakpoint
ALTER TABLE `phone_assignments` ADD `company_id` text NOT NULL DEFAULT 'company-unassigned';
--> statement-breakpoint
ALTER TABLE `audit_events` ADD `company_id` text NOT NULL DEFAULT 'company-unassigned';
--> statement-breakpoint
ALTER TABLE `compliance_checks` ADD `company_id` text NOT NULL DEFAULT 'company-unassigned';
--> statement-breakpoint
ALTER TABLE `evidences` ADD `company_id` text NOT NULL DEFAULT 'company-unassigned';
--> statement-breakpoint
ALTER TABLE `project_events` ADD `company_id` text NOT NULL DEFAULT 'company-unassigned';
--> statement-breakpoint
ALTER TABLE `whatsapp_messages` ADD `company_id` text NOT NULL DEFAULT 'company-unassigned';
--> statement-breakpoint
ALTER TABLE `project_baselines` ADD `company_id` text NOT NULL DEFAULT 'company-unassigned';
--> statement-breakpoint
UPDATE `project_baselines` SET `company_id` = (SELECT `company_id` FROM `projects` WHERE `projects`.`id` = `project_baselines`.`project_id`) WHERE EXISTS (SELECT 1 FROM `projects` WHERE `projects`.`id` = `project_baselines`.`project_id`);
--> statement-breakpoint
UPDATE `project_events` SET `company_id` = (SELECT `company_id` FROM `projects` WHERE `projects`.`id` = `project_events`.`project_id`) WHERE EXISTS (SELECT 1 FROM `projects` WHERE `projects`.`id` = `project_events`.`project_id`);
--> statement-breakpoint
UPDATE `phone_assignments` SET `company_id` = (SELECT `company_id` FROM `projects` WHERE `projects`.`id` = `phone_assignments`.`project_id`) WHERE EXISTS (SELECT 1 FROM `projects` WHERE `projects`.`id` = `phone_assignments`.`project_id`);
--> statement-breakpoint
UPDATE `evidences` SET `company_id` = (SELECT `company_id` FROM `occurrences` WHERE `occurrences`.`id` = `evidences`.`occurrence_id`) WHERE EXISTS (SELECT 1 FROM `occurrences` WHERE `occurrences`.`id` = `evidences`.`occurrence_id`);
--> statement-breakpoint
UPDATE `compliance_checks` SET `company_id` = (SELECT `company_id` FROM `occurrences` WHERE `occurrences`.`id` = `compliance_checks`.`occurrence_id`) WHERE EXISTS (SELECT 1 FROM `occurrences` WHERE `occurrences`.`id` = `compliance_checks`.`occurrence_id`);
--> statement-breakpoint
UPDATE `whatsapp_messages` SET `company_id` = (SELECT `company_id` FROM `occurrences` WHERE `occurrences`.`id` = `whatsapp_messages`.`occurrence_id`) WHERE EXISTS (SELECT 1 FROM `occurrences` WHERE `occurrences`.`id` = `whatsapp_messages`.`occurrence_id`);
--> statement-breakpoint
UPDATE `audit_events` SET `company_id` = (SELECT `company_id` FROM `occurrences` WHERE `occurrences`.`id` = `audit_events`.`occurrence_id`) WHERE EXISTS (SELECT 1 FROM `occurrences` WHERE `occurrences`.`id` = `audit_events`.`occurrence_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `phone_assignments_company_phone_unique` ON `phone_assignments` (`company_id`,`phone_e164`);
--> statement-breakpoint
CREATE INDEX `phone_assignments_phone_idx` ON `phone_assignments` (`phone_e164`);
--> statement-breakpoint
CREATE INDEX `audit_events_occurrence_idx` ON `audit_events` (`company_id`,`occurrence_id`);
--> statement-breakpoint
CREATE INDEX `compliance_checks_occurrence_idx` ON `compliance_checks` (`company_id`,`occurrence_id`);
--> statement-breakpoint
CREATE INDEX `compliance_checks_standard_idx` ON `compliance_checks` (`company_id`,`standard_code`);
--> statement-breakpoint
CREATE INDEX `compliance_checks_status_idx` ON `compliance_checks` (`company_id`,`status`);
--> statement-breakpoint
CREATE INDEX `evidences_occurrence_idx` ON `evidences` (`company_id`,`occurrence_id`);
--> statement-breakpoint
CREATE INDEX `occurrences_created_idx` ON `occurrences` (`company_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `occurrences_project_idx` ON `occurrences` (`company_id`,`project_id`);
--> statement-breakpoint
CREATE INDEX `occurrences_status_idx` ON `occurrences` (`company_id`,`status`);
--> statement-breakpoint
CREATE INDEX `project_events_project_idx` ON `project_events` (`company_id`,`project_id`);
--> statement-breakpoint
CREATE INDEX `whatsapp_messages_created_idx` ON `whatsapp_messages` (`company_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `whatsapp_messages_occurrence_idx` ON `whatsapp_messages` (`company_id`,`occurrence_id`);
--> statement-breakpoint
CREATE INDEX `project_baselines_company_idx` ON `project_baselines` (`company_id`);