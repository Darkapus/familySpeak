CREATE TABLE `ortho_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`category` text NOT NULL,
	`correct` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ortho_attempts_user_id_created_at_idx` ON `ortho_attempts` (`user_id`,`created_at`);