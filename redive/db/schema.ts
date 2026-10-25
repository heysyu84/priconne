import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const clanState = sqliteTable('clan_state', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull(),
  document: text('document').notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by'),
  mutationId: text('mutation_id').notNull(),
});

export const clanRevisions = sqliteTable('clan_revisions', {
  revision: integer('revision').primaryKey(),
  document: text('document').notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by'),
});

export const clanAdmins = sqliteTable('clan_admins', {
  userId: text('user_id').primaryKey(),
  createdAt: text('created_at').notNull(),
});

export const futureBossCache = sqliteTable('future_boss_cache', {
  id: text('id').primaryKey(),
  document: text('document').notNull(),
  refreshAfter: integer('refresh_after').notNull(),
  leaseUntil: integer('lease_until').notNull(),
});
