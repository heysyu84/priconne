import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const clanState = sqliteTable("clan_state", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const clanRevisions = sqliteTable("clan_revisions", {
  revision: integer("revision").primaryKey(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});
