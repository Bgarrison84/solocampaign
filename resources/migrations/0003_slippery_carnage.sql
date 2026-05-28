CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`session_number` integer NOT NULL,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ended_at` integer,
	`location` text,
	`goal` text,
	`context_notes` text,
	`ai_recap` text,
	`player_notes` text,
	`is_summarized` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `rolling_summary` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `session_id` text REFERENCES sessions(id);