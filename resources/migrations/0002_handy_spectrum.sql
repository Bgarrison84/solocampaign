CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `provider_type` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `endpoint_url` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `model_name` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `reference_docs` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `dm_personality` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `strictness` text DEFAULT 'balanced' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `fallback_endpoint_url` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `fallback_model_name` text;