ALTER TABLE "game_participants" ADD COLUMN "is_current_master" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "game_participants" ADD COLUMN "current_prompt" text;--> statement-breakpoint
ALTER TABLE "game_participants" ADD COLUMN "similarity" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "current_round" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "total_rounds" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "target_score" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "master_prompt" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "round_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "round_ended_at" timestamp;--> statement-breakpoint
ALTER TABLE "game_participants" DROP COLUMN IF EXISTS "prompt";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN IF EXISTS "prompt";