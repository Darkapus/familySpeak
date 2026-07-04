CREATE TABLE `world_blocks` (
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`z` integer NOT NULL,
	`block_type` text,
	`placed_by` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`x`, `y`, `z`),
	FOREIGN KEY (`placed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
