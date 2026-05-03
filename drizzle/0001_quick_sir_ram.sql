ALTER TABLE `games` ADD `challenge_result` text;--> statement-breakpoint
ALTER TABLE `games` ADD `challenge_acks` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `last_turn_result` text;