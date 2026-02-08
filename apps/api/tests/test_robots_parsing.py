from __future__ import annotations

from inplain.worker.handlers.common import _evaluate_robots


def test_robots_disallow_and_allow_longest_match_wins() -> None:
    robots_txt = "\n".join(
        [
            "User-agent: *",
            "Disallow: /private",
            "Allow: /private/public",
        ]
    )

    decision = _evaluate_robots(
        robots_txt=robots_txt, path="/private/secret", user_agent="inplain.ai"
    )
    assert decision.allowed is False
    assert decision.rule == "Disallow: /private"

    decision2 = _evaluate_robots(
        robots_txt=robots_txt, path="/private/public/info", user_agent="inplain.ai"
    )
    assert decision2.allowed is True


def test_robots_user_agent_group_is_selected() -> None:
    robots_txt = "\n".join(
        [
            "User-agent: inplain.ai",
            "Disallow: /nope",
            "",
            "User-agent: *",
            "Disallow: /all",
        ]
    )

    decision = _evaluate_robots(robots_txt=robots_txt, path="/nope", user_agent="inplain.ai")
    assert decision.allowed is False
    assert decision.rule == "Disallow: /nope"

    decision2 = _evaluate_robots(robots_txt=robots_txt, path="/all", user_agent="inplain.ai")
    assert decision2.allowed is True
