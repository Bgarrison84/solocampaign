ALTER TABLE `campaigns` ADD COLUMN `party_size` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `world_setup_mode` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `world_brief` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `world_document` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `encumbrance_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN `homebrew_content` text;--> statement-breakpoint
ALTER TABLE `characters` ADD COLUMN `classes` text;--> statement-breakpoint
ALTER TABLE `characters` ADD COLUMN `is_companion` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD COLUMN `negative_traits` text;
