import crypto from "node:crypto";

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type EntityOut = {
  id: string;
  slug: string;
  name: string;
  website_url: string;
  category: string;
  policy_urls: Record<string, unknown>;
};

export type DocumentOut = {
  id: string;
  clerk_user_id: string;
  entity_id: string;
  url: string;
  doc_type: "privacy" | "tos" | "cookie" | "other";
  status: "active" | "paused" | "blocked_robots" | "error";
  schedule_tier: "daily" | "6h" | "1h";
  next_check_at: string;
  last_checked_at: string | null;
  last_snapshot_id: string | null;
  etag: string | null;
  last_modified: string | null;
  robots_checked_at: string | null;
  robots_status: "unknown" | "allowed" | "disallowed";
  robots_rule: string | null;
  pause_reason: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type SnapshotOut = {
  id: string;
  document_id: string;
  fetched_at: string;
  fetch_method: string;
  http_status: number;
  content_type: string | null;
  extracted_text: string;
  extracted_sha256: string;
  extract_version: number;
  byte_size_extracted: number;
  created_at: string;
};

export type ChangeEventOut = {
  id: string;
  document_id: string;
  diff_id: string;
  title: string;
  summary_status: "pending" | "completed" | "failed" | "skipped_quota";
  summary_what_changed: SummaryBullet[] | null;
  summary_why_matters: SummaryBullet[] | null;
  summary_model: string | null;
  summary_prompt_version: number | null;
  summary_error: string | null;
  created_at: string;
};

export type Citation = {
  hunkId: string;
  quote: string;
  status?: "valid" | "repaired" | "unverified";
};
export type SummaryBullet = { text: string; citations: Citation[] };

export type DiffHunk = {
  hunkId: string;
  contextBefore: string;
  contextAfter: string;
  added: string[];
  removed: string[];
};

export type DiffOut = {
  id: string;
  document_id: string;
  from_snapshot_id: string;
  to_snapshot_id: string;
  diff_hunks: DiffHunk[];
  change_score: number;
  change_classification: string;
  created_at: string;
};

export type ChangeEventDetailOut = {
  change_event: ChangeEventOut;
  diff: DiffOut;
};

export type NotificationOut = {
  id: string;
  clerk_user_id: string;
  type: "change_detected" | "check_failed" | "system";
  title: string;
  body: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type UnreadCountOut = { unread: number };

export type UsageOut = {
  tracked_documents: number;
  check_now_used_today: number;
  render_used_month: number;
  summaries_used_month: number;
};

export type ExportOut = {
  generated_at: string;
  truncated: boolean;
  limit_change_events: number | null;
  entities: EntityOut[];
  documents: DocumentOut[];
  change_events: ChangeEventDetailOut[];
};

type InternalFetchOptions = {
  userId?: string;
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  cache?: RequestCache;
  timeoutMs?: number;
};

function sha256Hex(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

const DEFAULT_INTERNAL_FETCH_TIMEOUT_MS = 10_000;

function ensureHttpScheme(rawUrl: string): string {
  const url = rawUrl.trim();
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Internal API request timed out (${timeoutMs}ms)`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function internalFetch<T>(
  path: string,
  { userId, method = "GET", body, cache = "no-store", timeoutMs }: InternalFetchOptions = {},
): Promise<T> {
  const baseUrl = process.env.INTERNAL_API_BASE_URL;
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!baseUrl) {
    throw new Error("INTERNAL_API_BASE_URL not set");
  }
  if (!token) {
    throw new Error("INTERNAL_SERVICE_TOKEN not set");
  }

  const bodyText = body === undefined ? "" : JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payloadToSign = `${timestamp}\n${method.toUpperCase()}\n${path}\n${sha256Hex(bodyText)}`;
  const signature = hmacHex(token, payloadToSign);

  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "x-request-timestamp": timestamp,
    "x-request-signature": signature,
  };
  if (userId) {
    headers["x-clerk-user-id"] = userId;
  }
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const baseUrlNormalized = ensureHttpScheme(baseUrl).replace(/\/$/, "");
  const requestTimeoutMs =
    typeof timeoutMs === "number" && Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_INTERNAL_FETCH_TIMEOUT_MS;
  const res = await fetchWithTimeout(
    `${baseUrlNormalized}${path}`,
    {
      method,
      headers,
      body: body === undefined ? undefined : bodyText,
      cache,
    },
    requestTimeoutMs,
  );

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const env = payload as Partial<ErrorEnvelope>;
    const message = env?.error?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return payload as T;
}
