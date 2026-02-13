from __future__ import annotations

from inplain.db.models.enums import ScheduleTier
from inplain.worker.handlers.diff import _CLASSIFY_MODEL_CHAIN
from inplain.worker.handlers.summarize import _summary_policy_for_tier


def test_summary_policy_daily_is_cheap_first() -> None:
    policy = _summary_policy_for_tier(ScheduleTier.daily)

    assert policy.model_chain == [
        "deepseek/deepseek-v3.2",
        "google/gemini-3-flash-preview",
    ]
    assert policy.max_tokens == 650
    assert policy.max_bullets == 8


def test_summary_policy_six_h_includes_gpt_fallback() -> None:
    policy = _summary_policy_for_tier(ScheduleTier.six_h)

    assert policy.model_chain == [
        "deepseek/deepseek-v3.2",
        "google/gemini-3-flash-preview",
        "openai/gpt-5.2",
    ]
    assert policy.max_tokens == 850
    assert policy.max_bullets == 10


def test_summary_policy_one_h_includes_sonnet_fallback() -> None:
    policy = _summary_policy_for_tier(ScheduleTier.one_h)

    assert policy.model_chain == [
        "deepseek/deepseek-v3.2",
        "openai/gpt-5.2",
        "anthropic/claude-sonnet-4.5",
    ]
    assert policy.max_tokens == 1100
    assert policy.max_bullets == 12


def test_diff_classify_model_chain_is_cheap_first() -> None:
    assert _CLASSIFY_MODEL_CHAIN == [
        "deepseek/deepseek-v3.2",
        "google/gemini-3-flash-preview",
    ]
