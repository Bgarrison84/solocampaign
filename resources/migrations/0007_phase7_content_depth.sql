CREATE TABLE `custom_feats` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `character_feats` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`feat_name` text NOT NULL,
	`feat_source` text DEFAULT 'srd' NOT NULL,
	`custom_feat_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_feat_id`) REFERENCES `custom_feats`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `campaign_reference_docs` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`filename` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `party_size` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `world_setup_mode` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `world_brief` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `world_document` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `encumbrance_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `homebrew_content` text;--> statement-breakpoint
ALTER TABLE `characters` ADD `classes` text;--> statement-breakpoint
ALTER TABLE `characters` ADD `is_companion` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `negative_traits` text;--> statement-breakpoint
DROP INDEX IF EXISTS `characters_campaign_id_unique`;
