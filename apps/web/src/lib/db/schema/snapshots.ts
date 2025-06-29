/**
 * Database schema for snapshots and diffs
 * Phase 2: Data persistence layer
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
  jsonb,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { policies } from './policies'

/**
 * Snapshots table - stores policy content versions
 */
export const snapshots = pgTable('snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  policyId: uuid('policy_id').notNull().references(() => policies.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  hash: text('hash').notNull(),
  content: text('content').notNull(),
  compressed: boolean('compressed').default(false).notNull(),
  metadata: jsonb('metadata').notNull(),
  capturedAt: timestamp('captured_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  
  // Tracking fields
  sourceUrl: text('source_url'),
  statusCode: integer('status_code'),
  extractionMethod: text('extraction_method'),
  quality: integer('quality'), // 0-100
  language: text('language').default('en'),
  wordCount: integer('word_count'),
}, (table) => ({
  // Indexes for performance
  policyIdx: index('snapshots_policy_idx').on(table.policyId),
  versionIdx: index('snapshots_version_idx').on(table.policyId, table.version),
  hashIdx: index('snapshots_hash_idx').on(table.hash),
  capturedAtIdx: index('snapshots_captured_at_idx').on(table.capturedAt),
  
  // Unique constraint to prevent duplicate versions
  uniqueVersion: uniqueIndex('snapshots_unique_version').on(table.policyId, table.version),
  // Unique constraint for deduplication
  uniqueHash: uniqueIndex('snapshots_unique_hash').on(table.policyId, table.hash),
}))

/**
 * Diffs table - stores changes between snapshots
 */
export const diffs = pgTable('diffs', {
  id: uuid('id').defaultRandom().primaryKey(),
  policyId: uuid('policy_id').notNull().references(() => policies.id, { onDelete: 'cascade' }),
  fromSnapshotId: uuid('from_snapshot_id').notNull().references(() => snapshots.id, { onDelete: 'cascade' }),
  toSnapshotId: uuid('to_snapshot_id').notNull().references(() => snapshots.id, { onDelete: 'cascade' }),
  
  // Diff data
  changes: jsonb('changes').notNull(), // Array of DiffChange objects
  summary: jsonb('summary').notNull(), // DiffSummary object
  
  // Semantic analysis (if performed)
  semanticAnalysis: jsonb('semantic_analysis'), // SemanticDiff object
  riskScore: integer('risk_score'), // 0-100
  riskLevel: text('risk_level'), // low, medium, high, critical
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Indexes
  policyIdx: index('diffs_policy_idx').on(table.policyId),
  fromSnapshotIdx: index('diffs_from_snapshot_idx').on(table.fromSnapshotId),
  toSnapshotIdx: index('diffs_to_snapshot_idx').on(table.toSnapshotId),
  createdAtIdx: index('diffs_created_at_idx').on(table.createdAt),
  riskLevelIdx: index('diffs_risk_level_idx').on(table.riskLevel),
  
  // Unique constraint to prevent duplicate diffs
  uniqueDiff: uniqueIndex('diffs_unique').on(table.fromSnapshotId, table.toSnapshotId),
}))

/**
 * Snapshot cache table - for quick access to latest content
 */
export const snapshotCache = pgTable('snapshot_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  policyId: uuid('policy_id').notNull().references(() => policies.id, { onDelete: 'cascade' }),
  snapshotId: uuid('snapshot_id').notNull().references(() => snapshots.id, { onDelete: 'cascade' }),
  
  // Cached processed content
  processedContent: jsonb('processed_content').notNull(), // Structured content
  summary: text('summary'), // AI-generated summary
  keyPoints: jsonb('key_points'), // Array of key points
  privacyScore: integer('privacy_score'), // 0-100
  
  // Cache metadata
  processingVersion: text('processing_version').notNull(), // Version of processing logic
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  policyIdx: index('snapshot_cache_policy_idx').on(table.policyId),
  snapshotIdx: index('snapshot_cache_snapshot_idx').on(table.snapshotId),
  expiresAtIdx: index('snapshot_cache_expires_at_idx').on(table.expiresAt),
  
  // Unique constraint - one cache entry per snapshot
  uniqueSnapshot: uniqueIndex('snapshot_cache_unique').on(table.snapshotId),
}))

/**
 * Relations
 */
export const snapshotsRelations = relations(snapshots, ({ one, many }) => ({
  policy: one(policies, {
    fields: [snapshots.policyId],
    references: [policies.id],
  }),
  diffsFrom: many(diffs, { relationName: 'fromSnapshot' }),
  diffsTo: many(diffs, { relationName: 'toSnapshot' }),
  cache: one(snapshotCache, {
    fields: [snapshots.id],
    references: [snapshotCache.snapshotId],
  }),
}))

export const diffsRelations = relations(diffs, ({ one }) => ({
  policy: one(policies, {
    fields: [diffs.policyId],
    references: [policies.id],
  }),
  fromSnapshot: one(snapshots, {
    fields: [diffs.fromSnapshotId],
    references: [snapshots.id],
    relationName: 'fromSnapshot',
  }),
  toSnapshot: one(snapshots, {
    fields: [diffs.toSnapshotId],
    references: [snapshots.id],
    relationName: 'toSnapshot',
  }),
}))

export const snapshotCacheRelations = relations(snapshotCache, ({ one }) => ({
  policy: one(policies, {
    fields: [snapshotCache.policyId],
    references: [policies.id],
  }),
  snapshot: one(snapshots, {
    fields: [snapshotCache.snapshotId],
    references: [snapshots.id],
  }),
}))

/**
 * Type exports
 */
export type Snapshot = typeof snapshots.$inferSelect
export type NewSnapshot = typeof snapshots.$inferInsert
export type Diff = typeof diffs.$inferSelect
export type NewDiff = typeof diffs.$inferInsert
export type SnapshotCache = typeof snapshotCache.$inferSelect
export type NewSnapshotCache = typeof snapshotCache.$inferInsert