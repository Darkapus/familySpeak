CREATE TABLE `hermes_conversation_summaries` (
	`conversation_id` text PRIMARY KEY NOT NULL,
	`summary` text NOT NULL,
	`summarized_up_to_created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
