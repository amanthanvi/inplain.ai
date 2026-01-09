from __future__ import annotations

from inplain.db.models.enums import Plan

DEFAULT_LIMITS_BY_PLAN: dict[Plan, dict] = {
    Plan.free: {
        "tracked_documents": 3,
        "schedule_frequency": "daily",
        "check_now_per_day": 10,
        "js_render_fetches_per_month": 0,
        "ai_summaries_per_month": 10,
        "email_notifications": "immediate",
        "email_notifications_max_per_month": 20,
        "history_retention_days": 30,
        "export": "last_10_events",
    },
    Plan.pro: {
        "tracked_documents": 25,
        "schedule_frequency": "6h",
        "check_now_per_day": 100,
        "js_render_fetches_per_month": 200,
        "ai_summaries_per_month": 500,
        "email_notifications": "immediate_and_daily_digest",
        "history_retention_days": 180,
        "export": "full",
    },
    Plan.business: {
        "tracked_documents": 200,
        "schedule_frequency": "1h",
        "check_now_per_day": 500,
        "js_render_fetches_per_month": 2000,
        "ai_summaries_per_month": 5000,
        "email_notifications": "immediate_and_daily_digest",
        "history_retention_days": 730,
        "export": "full",
    },
}


def default_limits(plan: Plan) -> dict:
    return dict(DEFAULT_LIMITS_BY_PLAN[plan])

