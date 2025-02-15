ALTER TABLE "games" ADD COLUMN "code" varchar(8) NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_code_unique" UNIQUE("code");