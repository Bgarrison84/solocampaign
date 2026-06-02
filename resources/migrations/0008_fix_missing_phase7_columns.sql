ALTER TABLE `campaigns` ADD COLUMN IF NOT EXISTS `party_size` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN IF NOT EXISTS `world_setup_mode` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN IF NOT EXISTS `world_brief` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN IF NOT EXISTS `world_document` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN IF NOT EXISTS `encumbrance_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD COLUMN IF NOT EXISTS `homebrew_content` text;--> statement-breakpoint
ALTER TABLE `characters` ADD COLUMN IF NOT EXISTS `classes` text;--> statement-breakpoint
ALTER TABLE `characters` ADD COLUMN IF NOT EXISTS `is_companion` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD COLUMN IF NOT EXISTS `negative_traits` text;
