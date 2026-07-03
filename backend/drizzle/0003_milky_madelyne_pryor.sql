CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`profile` text NOT NULL,
	`last_message_considered_created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
