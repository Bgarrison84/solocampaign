CREATE TABLE `combatants` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`session_id` text,
	`name` text NOT NULL,
	`hp_current` integer NOT NULL,
	`hp_max` integer NOT NULL,
	`ac` integer DEFAULT 10 NOT NULL,
	`initiative` integer DEFAULT 0 NOT NULL,
	`initiative_order` integer DEFAULT 0 NOT NULL,
	`conditions` text DEFAULT '[]' NOT NULL,
	`is_player` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaign_events` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`session_id` text,
	`event_type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_spells` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`spell_name` text NOT NULL,
	`spell_level` integer DEFAULT 0 NOT NULL,
	`is_prepared` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `character_resources` ADD `concentrating_on` text;--> statement-breakpoint
ALTER TABLE `character_resources` ADD `hit_dice_current` integer;--> statement-breakpoint
ALTER TABLE `character_resources` ADD `hit_dice_total` integer;--> statement-breakpoint
ALTER TABLE `character_resources` ADD `pact_slots` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `permadeath_mode` integer DEFAULT false NOT NULL;