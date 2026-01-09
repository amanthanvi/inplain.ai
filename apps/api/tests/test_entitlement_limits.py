from inplain.db.models.enums import FetchMode, ScheduleTier
from inplain.entitlements.limits import force_render_allowed, schedule_tier_allowed


def test_schedule_tier_allowed() -> None:
    assert schedule_tier_allowed("daily", ScheduleTier.daily) is True
    assert schedule_tier_allowed("daily", ScheduleTier.six_h) is False
    assert schedule_tier_allowed("daily", ScheduleTier.one_h) is False

    assert schedule_tier_allowed("6h", ScheduleTier.daily) is True
    assert schedule_tier_allowed("6h", ScheduleTier.six_h) is True
    assert schedule_tier_allowed("6h", ScheduleTier.one_h) is False

    assert schedule_tier_allowed("1h", ScheduleTier.daily) is True
    assert schedule_tier_allowed("1h", ScheduleTier.six_h) is True
    assert schedule_tier_allowed("1h", ScheduleTier.one_h) is True


def test_force_render_allowed() -> None:
    assert force_render_allowed(0, FetchMode.force_render) is False
    assert force_render_allowed(1, FetchMode.force_render) is True
    assert force_render_allowed(None, FetchMode.force_render) is False
    assert force_render_allowed(0, FetchMode.auto) is True

