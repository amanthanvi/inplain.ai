from __future__ import annotations

from enum import StrEnum


class DocumentDocType(StrEnum):
    privacy = "privacy"
    tos = "tos"
    cookie = "cookie"
    other = "other"


class DocumentStatus(StrEnum):
    active = "active"
    paused = "paused"
    blocked_robots = "blocked_robots"
    error = "error"


class ScheduleTier(StrEnum):
    daily = "daily"
    six_h = "6h"
    one_h = "1h"


class RobotsStatus(StrEnum):
    unknown = "unknown"
    allowed = "allowed"
    disallowed = "disallowed"


class DiffClassification(StrEnum):
    cosmetic = "cosmetic"
    meaningful = "meaningful"
    major = "major"


class SummaryStatus(StrEnum):
    pending = "pending"
    completed = "completed"
    failed = "failed"
    skipped_quota = "skipped_quota"


class JobQueue(StrEnum):
    fetch = "fetch"
    render = "render"
    diff = "diff"
    summarize = "summarize"
    notify = "notify"
    cleanup = "cleanup"


class JobStatus(StrEnum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    dead = "dead"


class NotificationType(StrEnum):
    change_detected = "change_detected"
    check_failed = "check_failed"
    system = "system"

