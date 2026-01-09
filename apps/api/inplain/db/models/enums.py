import enum


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class UserStatus(str, enum.Enum):
    active = "active"
    banned = "banned"


class Plan(str, enum.Enum):
    free = "free"
    pro = "pro"
    business = "business"


class DocumentDocType(str, enum.Enum):
    privacy = "privacy"
    tos = "tos"
    cookie = "cookie"
    other = "other"


class DocumentStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    blocked_robots = "blocked_robots"
    error = "error"


class FetchMode(str, enum.Enum):
    auto = "auto"
    http_only = "http_only"
    force_render = "force_render"


class ScheduleTier(str, enum.Enum):
    daily = "daily"
    six_h = "6h"
    one_h = "1h"


class RobotsStatus(str, enum.Enum):
    unknown = "unknown"
    allowed = "allowed"
    disallowed = "disallowed"


class SnapshotFetchMethod(str, enum.Enum):
    http = "http"
    render = "render"


class DiffFormat(str, enum.Enum):
    unified = "unified"
    segments_v1 = "segments_v1"


class ChangeEventType(str, enum.Enum):
    meaningful_change = "meaningful_change"


class SummaryStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"
    skipped_quota = "skipped_quota"


class EmailMode(str, enum.Enum):
    immediate = "immediate"
    daily_digest = "daily_digest"


class NotificationChannel(str, enum.Enum):
    email = "email"


class NotificationStatus(str, enum.Enum):
    queued = "queued"
    sent = "sent"
    failed = "failed"
    suppressed_unsubscribed = "suppressed_unsubscribed"


class EmailProvider(str, enum.Enum):
    postmark = "postmark"


class JobType(str, enum.Enum):
    fetch = "fetch"
    render = "render"
    diff = "diff"
    summarize = "summarize"
    notify = "notify"
    cleanup = "cleanup"


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    dead = "dead"


class Provider(str, enum.Enum):
    openrouter = "openrouter"
    playwright = "playwright"
    http_fetch = "http_fetch"
    postmark = "postmark"


class ProviderAction(str, enum.Enum):
    summary = "summary"
    render_fetch = "render_fetch"
    http_fetch = "http_fetch"
    email_send = "email_send"


class WebhookSource(str, enum.Enum):
    clerk = "clerk"
    stripe = "stripe"
    postmark = "postmark"


class WebhookStatus(str, enum.Enum):
    received = "received"
    processed = "processed"
    failed = "failed"
