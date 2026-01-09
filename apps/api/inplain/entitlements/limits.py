from __future__ import annotations

from inplain.db.models.enums import FetchMode, ScheduleTier

_SCHEDULE_RANK: dict[ScheduleTier, int] = {
    ScheduleTier.daily: 1,
    ScheduleTier.six_h: 2,
    ScheduleTier.one_h: 3,
}

_LIMIT_RANK: dict[str, int] = {
    "daily": 1,
    "6h": 2,
    "1h": 3,
}


def schedule_tier_allowed(max_frequency: str | None, requested: ScheduleTier) -> bool:
    if max_frequency is None:
        return False
    max_rank = _LIMIT_RANK.get(max_frequency)
    if max_rank is None:
        return False
    return _SCHEDULE_RANK[requested] <= max_rank


def force_render_allowed(js_render_fetches_per_month: int | None, fetch_mode: FetchMode) -> bool:
    if fetch_mode != FetchMode.force_render:
        return True
    if js_render_fetches_per_month is None:
        return False
    return js_render_fetches_per_month > 0

