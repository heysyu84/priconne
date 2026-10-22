import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

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
export const clanArchiveMonths = sqliteTable("clan_archive_months", {
  month: text("month").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const clanPresence = sqliteTable("clan_presence", {
  browserId: text("browser_id").primaryKey(),
  lastSeen: integer("last_seen").notNull(),
}, table => [index("clan_presence_last_seen_idx").on(table.lastSeen)]);
