import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  varchar,
  uuid,
  unique,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  isPublic: boolean("is_public").notNull().default(true),
  status: text("status").notNull().default("waiting"), // waiting, playing, finished
  currentRound: integer("current_round").default(0),
  totalRounds: integer("total_rounds").default(5),
  targetScore: integer("target_score").default(5),
  masterId: uuid("master_id").references(() => users.id),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id),
  masterPrompt: text("master_prompt"),
  masterImageUrl: text("master_image_url"),
  roundStartedAt: timestamp("round_started_at"),
  roundEndedAt: timestamp("round_ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const gameParticipants = pgTable(
  "game_participants",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id").references(() => games.id),
    userId: uuid("user_id").references(() => users.id),
    isReady: boolean("is_ready").default(false),
    isCurrentMaster: boolean("is_current_master").default(false),
    currentPrompt: text("current_prompt"),
    imageUrl: text("image_url"),
    score: integer("score").default(0),
    similarity: integer("similarity"), // Similarité avec le prompt du maître (0-100)
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => {
    return {
      uniqueGameParticipant: unique().on(table.gameId, table.userId),
    };
  }
);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id),
  userId: uuid("user_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
