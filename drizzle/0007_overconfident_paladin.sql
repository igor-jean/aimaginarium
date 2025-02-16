CREATE TABLE IF NOT EXISTS "player_prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer,
	"user_id" uuid,
	"round" integer NOT NULL,
	"prompt" text NOT NULL,
	"similarity" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "player_prompts_game_id_user_id_round_unique" UNIQUE("game_id","user_id","round")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_prompts" ADD CONSTRAINT "player_prompts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_prompts" ADD CONSTRAINT "player_prompts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
