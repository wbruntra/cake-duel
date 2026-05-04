CREATE TABLE `game_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `game_id` text NOT NULL,
  `seq` integer NOT NULL,
  `type` text NOT NULL,
  `player` text,
  `data` text,
  `created_at` text NOT NULL
);
