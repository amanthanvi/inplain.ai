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
  summary_what_changed: Array<Record<string, unknown>> | null;
  summary_why_matters: Array<Record<string, unknown>> | null;
  summary_model: string | null;
  summary_prompt_version: number | null;
  summary_error: string | null;
  created_at: string;
};

export type DiffOut = {
  id: string;
  document_id: string;
  from_snapshot_id: string;
  to_snapshot_id: string;
  diff_hunks: Array<Record<string, unknown>>;
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

type InternalFetchOptions = {
  userId?: string;
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  cache?: RequestCache;
};

export async function internalFetch<T>(
  path: string,
  { userId, method = "GET", body, cache = "no-store" }: InternalFetchOptions = {},
): Promise<T> {
  const baseUrl = process.env.INTERNAL_API_BASE_URL;
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!baseUrl) {
    throw new Error("INTERNAL_API_BASE_URL not set");
  }
  if (!token) {
    throw new Error("INTERNAL_SERVICE_TOKEN not set");
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
  };
  if (userId) {
    headers["x-clerk-user-id"] = userId;
  }
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache,
  });

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

