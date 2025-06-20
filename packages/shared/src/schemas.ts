import { z } from 'zod'

export const SnapshotMetaSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  url: z.string().url(),
  capturedAt: z.string().datetime(),
  blobKey: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  contentLength: z.number().int().positive(),
  contentType: z.enum(['html', 'pdf', 'text']),
  headers: z.record(z.string()),
  status: z.enum(['pending', 'processed', 'failed']),
  error: z.string().optional()
})

export const DiffMetaSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  fromSnapshotId: z.string().uuid(),
  toSnapshotId: z.string().uuid(),
  createdAt: z.string().datetime(),
  changeCount: z.number().int().nonnegative(),
  changeType: z.enum(['minor', 'moderate', 'major']),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  diffBlobKey: z.string().min(1),
  summaryId: z.string().uuid().optional()
})

export const SummarySchema = z.object({
  id: z.string().uuid(),
  diffId: z.string().uuid(),
  createdAt: z.string().datetime(),
  model: z.string().default('claude-4-opus'),
  prompt: z.string().min(1),
  summary: z.string().min(1),
  highlights: z.array(z.string()),
  riskLevel: z.enum(['low', 'medium', 'high']),
  categories: z.array(z.enum([
    'data_collection',
    'data_sharing',
    'data_retention',
    'user_rights',
    'security',
    'cookies',
    'third_parties',
    'children',
    'other'
  ])),
  tokensUsed: z.number().int().positive(),
  cached: z.boolean().default(false)
})

export const CompanySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  category: z.string().optional(),
  checkInterval: z.number().int().positive().default(3600),
  lastChecked: z.string().datetime().optional(),
  active: z.boolean().default(true)
})

export const CrawlJobSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  url: z.string().url(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  retries: z.number().int().nonnegative().default(0),
  error: z.string().optional()
})

export type SnapshotMeta = z.infer<typeof SnapshotMetaSchema>
export type DiffMeta = z.infer<typeof DiffMetaSchema>
export type Summary = z.infer<typeof SummarySchema>
export type Company = z.infer<typeof CompanySchema>
export type CrawlJob = z.infer<typeof CrawlJobSchema>