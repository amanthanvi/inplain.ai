import { z } from 'zod';

declare const SnapshotMetaSchema: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    url: z.ZodString;
    capturedAt: z.ZodString;
    blobKey: z.ZodString;
    contentHash: z.ZodString;
    contentLength: z.ZodNumber;
    contentType: z.ZodEnum<["html", "pdf", "text"]>;
    headers: z.ZodRecord<z.ZodString, z.ZodString>;
    status: z.ZodEnum<["pending", "processed", "failed"]>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    slug: string;
    url: string;
    capturedAt: string;
    blobKey: string;
    contentHash: string;
    contentLength: number;
    contentType: "html" | "pdf" | "text";
    status: "pending" | "processed" | "failed";
    headers: Record<string, string>;
    error?: string | undefined;
}, {
    id: string;
    slug: string;
    url: string;
    capturedAt: string;
    blobKey: string;
    contentHash: string;
    contentLength: number;
    contentType: "html" | "pdf" | "text";
    status: "pending" | "processed" | "failed";
    headers: Record<string, string>;
    error?: string | undefined;
}>;
declare const DiffMetaSchema: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    fromSnapshotId: z.ZodString;
    toSnapshotId: z.ZodString;
    createdAt: z.ZodString;
    changeCount: z.ZodNumber;
    changeType: z.ZodEnum<["minor", "moderate", "major"]>;
    additions: z.ZodNumber;
    deletions: z.ZodNumber;
    diffBlobKey: z.ZodString;
    summaryId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    slug: string;
    fromSnapshotId: string;
    toSnapshotId: string;
    createdAt: string;
    changeCount: number;
    changeType: "minor" | "moderate" | "major";
    additions: number;
    deletions: number;
    diffBlobKey: string;
    summaryId?: string | undefined;
}, {
    id: string;
    slug: string;
    fromSnapshotId: string;
    toSnapshotId: string;
    createdAt: string;
    changeCount: number;
    changeType: "minor" | "moderate" | "major";
    additions: number;
    deletions: number;
    diffBlobKey: string;
    summaryId?: string | undefined;
}>;
declare const SummarySchema: z.ZodObject<{
    id: z.ZodString;
    diffId: z.ZodString;
    createdAt: z.ZodString;
    model: z.ZodDefault<z.ZodString>;
    prompt: z.ZodString;
    summary: z.ZodString;
    highlights: z.ZodArray<z.ZodString, "many">;
    riskLevel: z.ZodEnum<["low", "medium", "high"]>;
    categories: z.ZodArray<z.ZodEnum<["data_collection", "data_sharing", "data_retention", "user_rights", "security", "cookies", "third_parties", "children", "other"]>, "many">;
    tokensUsed: z.ZodNumber;
    cached: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    diffId: string;
    model: string;
    prompt: string;
    summary: string;
    highlights: string[];
    riskLevel: "low" | "medium" | "high";
    categories: ("data_collection" | "data_sharing" | "data_retention" | "user_rights" | "security" | "cookies" | "third_parties" | "children" | "other")[];
    tokensUsed: number;
    cached: boolean;
}, {
    id: string;
    createdAt: string;
    diffId: string;
    prompt: string;
    summary: string;
    highlights: string[];
    riskLevel: "low" | "medium" | "high";
    categories: ("data_collection" | "data_sharing" | "data_retention" | "user_rights" | "security" | "cookies" | "third_parties" | "children" | "other")[];
    tokensUsed: number;
    model?: string | undefined;
    cached?: boolean | undefined;
}>;
declare const CompanySchema: z.ZodObject<{
    slug: z.ZodString;
    name: z.ZodString;
    url: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    checkInterval: z.ZodDefault<z.ZodNumber>;
    lastChecked: z.ZodOptional<z.ZodString>;
    active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    slug: string;
    url: string;
    name: string;
    checkInterval: number;
    active: boolean;
    category?: string | undefined;
    lastChecked?: string | undefined;
}, {
    slug: string;
    url: string;
    name: string;
    category?: string | undefined;
    checkInterval?: number | undefined;
    lastChecked?: string | undefined;
    active?: boolean | undefined;
}>;
declare const CrawlJobSchema: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    url: z.ZodString;
    status: z.ZodEnum<["pending", "running", "completed", "failed"]>;
    createdAt: z.ZodString;
    startedAt: z.ZodOptional<z.ZodString>;
    completedAt: z.ZodOptional<z.ZodString>;
    retries: z.ZodDefault<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    slug: string;
    url: string;
    status: "pending" | "failed" | "running" | "completed";
    createdAt: string;
    retries: number;
    error?: string | undefined;
    startedAt?: string | undefined;
    completedAt?: string | undefined;
}, {
    id: string;
    slug: string;
    url: string;
    status: "pending" | "failed" | "running" | "completed";
    createdAt: string;
    error?: string | undefined;
    startedAt?: string | undefined;
    completedAt?: string | undefined;
    retries?: number | undefined;
}>;
type SnapshotMeta = z.infer<typeof SnapshotMetaSchema>;
type DiffMeta = z.infer<typeof DiffMetaSchema>;
type Summary = z.infer<typeof SummarySchema>;
type Company = z.infer<typeof CompanySchema>;
type CrawlJob = z.infer<typeof CrawlJobSchema>;

declare function slugify(text: string): string;
declare function formatTimestamp(date?: Date): string;
declare function parseTimestamp(timestamp: string): Date;
declare function getTimeDiff(from: string | Date, to?: string | Date): number;
declare function formatDuration(ms: number): string;
declare function hashContent(content: string): string;
declare function truncate(text: string, maxLength: number, suffix?: string): string;
declare function extractDomain(url: string): string;
declare function normalizeUrl(url: string): string;
declare const RISK_LEVELS: {
    readonly low: {
        readonly label: "Low Risk";
        readonly color: "green";
    };
    readonly medium: {
        readonly label: "Medium Risk";
        readonly color: "yellow";
    };
    readonly high: {
        readonly label: "High Risk";
        readonly color: "red";
    };
};
declare const CHANGE_TYPES: {
    readonly minor: {
        readonly label: "Minor Changes";
        readonly threshold: 0.05;
    };
    readonly moderate: {
        readonly label: "Moderate Changes";
        readonly threshold: 0.15;
    };
    readonly major: {
        readonly label: "Major Changes";
        readonly threshold: 0.3;
    };
};
declare function calculateChangeType(additions: number, deletions: number, total: number): 'minor' | 'moderate' | 'major';

export { CHANGE_TYPES, type Company, CompanySchema, type CrawlJob, CrawlJobSchema, type DiffMeta, DiffMetaSchema, RISK_LEVELS, type SnapshotMeta, SnapshotMetaSchema, type Summary, SummarySchema, calculateChangeType, extractDomain, formatDuration, formatTimestamp, getTimeDiff, hashContent, normalizeUrl, parseTimestamp, slugify, truncate };
