CREATE TABLE `chess_analysis_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `chess_games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chess_analysis_jobs_game_id_unique` ON `chess_analysis_jobs` (`game_id`);--> statement-breakpoint
CREATE INDEX `chess_analysis_jobs_status_created_at_idx` ON `chess_analysis_jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `chess_games` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`chess_com_username` text,
	`chess_com_game_url` text,
	`pgn` text NOT NULL,
	`result` text NOT NULL,
	`player_color` text NOT NULL,
	`opponent_name` text,
	`time_control` text,
	`engine_level` integer,
	`played_at` integer NOT NULL,
	`analysis_status` text DEFAULT 'none' NOT NULL,
	`analyzed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chess_games_chess_com_game_url_unique` ON `chess_games` (`chess_com_game_url`);--> statement-breakpoint
CREATE INDEX `chess_games_user_id_idx` ON `chess_games` (`user_id`);--> statement-breakpoint
CREATE INDEX `chess_games_user_id_played_at_idx` ON `chess_games` (`user_id`,`played_at`);--> statement-breakpoint
CREATE TABLE `chess_lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`content_markdown` text NOT NULL,
	`example_game_id` text,
	`example_ply` integer,
	`read_at` integer,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`example_game_id`) REFERENCES `chess_games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chess_lessons_user_id_generated_at_idx` ON `chess_lessons` (`user_id`,`generated_at`);--> statement-breakpoint
CREATE TABLE `chess_move_evals` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`user_id` text NOT NULL,
	`ply` integer NOT NULL,
	`moved_by` text NOT NULL,
	`fen_before` text NOT NULL,
	`move_san` text NOT NULL,
	`move_uci` text NOT NULL,
	`best_move_san` text NOT NULL,
	`best_move_uci` text NOT NULL,
	`eval_before_cp` integer NOT NULL,
	`eval_after_cp` integer NOT NULL,
	`centipawn_loss` integer NOT NULL,
	`quality` text NOT NULL,
	`mistake_category` text,
	FOREIGN KEY (`game_id`) REFERENCES `chess_games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chess_move_evals_game_id_ply_idx` ON `chess_move_evals` (`game_id`,`ply`);--> statement-breakpoint
CREATE INDEX `chess_move_evals_user_id_category_idx` ON `chess_move_evals` (`user_id`,`mistake_category`);--> statement-breakpoint
CREATE TABLE `chess_weakness_profile` (
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`occurrence_count` integer DEFAULT 0 NOT NULL,
	`total_centipawn_loss` integer DEFAULT 0 NOT NULL,
	`last_occurred_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `category`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
