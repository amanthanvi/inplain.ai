from __future__ import annotations

from inplain.db.models.enums import ScheduleTier
from inplain.worker.handlers.diff import _CLASSIFY_MODEL_CHAIN
from inplain.worker.handlers.summarize import _summary_policy_for_tier


def test_summary_policy_daily_is_cheap_first() -> None:
    policy = _summary_policy_for_tier(ScheduleTier.daily)

    assert policy.model_chain == [
        "z-ai/glm-4.7-flash",
        "minimax/minimax-m2.1",
        "google/gemini-2.5-flash-lite",
    ]
    assert policy.max_tokens == 500
    assert policy.max_bullets == 6


def test_summary_policy_six_h_includes_gpt_fallback() -> None:
    policy = _summary_policy_for_tier(ScheduleTier.six_h)

    assert policy.model_chain == [
        "minimax/minimax-m2.5",
        "moonshotai/kimi-k2.5",
        "z-ai/glm-5",
        "openai/gpt-4.1-mini",
    ]
    assert policy.max_tokens == 750
    assert policy.max_bullets == 8


def test_summary_policy_one_h_includes_gpt5_fallback() -> None:
    policy = _summary_policy_for_tier(ScheduleTier.one_h)

    assert policy.model_chain == [
        "minimax/minimax-m2.5",
        "moonshotai/kimi-k2.5",
        "z-ai/glm-5",
        "openai/gpt-5.2",
    ]
    assert policy.max_tokens == 950
    assert policy.max_bullets == 10


def test_diff_classify_model_chain_is_cheap_first() -> None:
    assert _CLASSIFY_MODEL_CHAIN == [
        "z-ai/glm-4.7-flash",
        "minimax/minimax-m2.1",
        "google/gemini-2.5-flash-lite",
    ]
