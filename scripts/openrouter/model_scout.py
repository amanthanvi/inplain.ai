from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

MODELS_URL = "https://openrouter.ai/api/v1/models"
RANKINGS_URL = "https://openrouter.ai/rankings"


@dataclass(frozen=True)
class ModelInfo:
    model_id: str
    name: str
    context_length: int | None
    prompt_per_token: float | None
    completion_per_token: float | None
    supports_structured_outputs: bool


def _fetch_json(url: str) -> dict[str, Any]:
    req = Request(url, headers={"user-agent": "inplain-model-scout/0.1"})
    with urlopen(req, timeout=30) as resp:  # noqa: S310
        data = json.loads(resp.read().decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Unexpected JSON root for {url}")
    return data


def _fetch_text(url: str) -> str:
    req = Request(url, headers={"user-agent": "inplain-model-scout/0.1"})
    with urlopen(req, timeout=30) as resp:  # noqa: S310
        return resp.read().decode("utf-8", errors="replace")


def _as_float(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _per_million(dollars_per_token: float | None) -> float | None:
    if dollars_per_token is None:
        return None
    return dollars_per_token * 1_000_000.0


def _format_usd_per_million(dollars_per_token: float | None) -> str:
    v = _per_million(dollars_per_token)
    if v is None:
        return "?"
    if v == 0:
        return "$0"
    if v < 0.01:
        return f"${v:.4f}"
    if v < 1:
        return f"${v:.3f}"
    return f"${v:.2f}"


def _extract_model_info(raw: dict[str, Any]) -> ModelInfo:
    model_id = str(raw.get("id") or "")
    name = str(raw.get("name") or model_id)

    context_length_raw = raw.get("context_length")
    context_length = int(context_length_raw) if isinstance(context_length_raw, int) else None

    pricing = raw.get("pricing") or {}
    prompt = _as_float(pricing.get("prompt"))
    completion = _as_float(pricing.get("completion"))

    supported = raw.get("supported_parameters") or []
    supports_structured_outputs = (
        isinstance(supported, list)
        and "structured_outputs" in supported
        and "response_format" in supported
    )

    return ModelInfo(
        model_id=model_id,
        name=name,
        context_length=context_length,
        prompt_per_token=prompt,
        completion_per_token=completion,
        supports_structured_outputs=supports_structured_outputs,
    )


def _parse_trending_model_slugs(html: str, *, limit: int) -> list[tuple[str, str]]:
    # Best-effort: OpenRouter rankings is a Next.js page; we extract the first N model links.
    # Example: <a ... href="/google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</a>
    pattern = re.compile(r'href="/([a-z0-9-]+/[a-z0-9-.:]+)"[^>]*>([^<]{2,80})</a>')

    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    skip_providers = {"docs", "blog", "legal", "privacy", "terms"}

    for slug, label in pattern.findall(html):
        provider = slug.split("/", 1)[0]
        if provider in skip_providers:
            continue
        if slug in seen:
            continue
        seen.add(slug)
        out.append((slug, label.strip()))
        if len(out) >= limit:
            break
    return out


def _estimate_max_summary_cost_usd(
    *,
    prompt_tokens: int,
    max_completion_tokens: int,
    prompt_per_token: float | None,
    completion_per_token: float | None,
) -> float | None:
    if prompt_per_token is None or completion_per_token is None:
        return None
    return (prompt_tokens * prompt_per_token) + (max_completion_tokens * completion_per_token)


def _format_usd(value: float | None) -> str:
    if value is None:
        return "?"
    return f"${value:.4f}"


def build_report(*, out_path: Path) -> None:
    now = datetime.now(UTC)

    models_payload = _fetch_json(MODELS_URL)
    raw_models = models_payload.get("data")
    if not isinstance(raw_models, list):
        raise ValueError("OpenRouter models payload missing data[]")

    models = {str(m.get("id")): _extract_model_info(m) for m in raw_models if isinstance(m, dict)}

    # Inplain policy models (must match SPEC Appendix C and worker handler constants).
    policy_model_ids = [
        "deepseek/deepseek-v3.2",
        "google/gemini-2.5-flash-lite",
        "openai/gpt-4.1-nano",
        "openai/gpt-4o-mini",
        "openai/gpt-4.1-mini",
        "openai/gpt-5.2",
        "anthropic/claude-sonnet-4.5",
    ]

    rankings_html = _fetch_text(RANKINGS_URL)
    trending = _parse_trending_model_slugs(rankings_html, limit=12)

    # Cost assumptions (bounds): prompt is capped by our worker; tokens vary but we use a stable estimate.
    assumed_prompt_tokens = 12_000

    tier_caps = {
        "daily (Free)": {"max_completion_tokens": 500, "max_bullets": 6},
        "6h (Pro)": {"max_completion_tokens": 750, "max_bullets": 8},
        "1h (Business)": {"max_completion_tokens": 950, "max_bullets": 10},
    }

    lines: list[str] = []
    lines.append("# OpenRouter Model Scout")
    lines.append("")
    lines.append(f"Generated: {now.isoformat()} (UTC)")
    lines.append("")
    lines.append("Sources:")
    lines.append(f"- {MODELS_URL}")
    lines.append(f"- {RANKINGS_URL}")
    lines.append("")

    lines.append("## Inplain v0.2.0 Model Policy")
    lines.append("")
    lines.append("These should match `SPEC.md` Appendix C and worker defaults:")
    lines.append("")
    lines.append("- Change classification (ambiguous diffs): `deepseek/deepseek-v3.2` → `google/gemini-2.5-flash-lite` → `openai/gpt-4.1-nano` (max_tokens=220)")
    lines.append("- Summary (tier-aware by schedule):")
    lines.append("  - `daily`: `deepseek/deepseek-v3.2` → `google/gemini-2.5-flash-lite`")
    lines.append("  - `6h`: `deepseek/deepseek-v3.2` → `openai/gpt-4o-mini` → `openai/gpt-4.1-mini`")
    lines.append("  - `1h`: `deepseek/deepseek-v3.2` → `openai/gpt-4.1-mini` → `openai/gpt-5.2` → `anthropic/claude-sonnet-4.5`")
    lines.append("")

    lines.append("## Pricing (USD per 1M tokens)")
    lines.append("")
    lines.append("OpenRouter `pricing` fields are USD per token; this table converts to USD per 1M tokens.")
    lines.append("")
    lines.append("| Model | Prompt / 1M | Completion / 1M | Context | Structured outputs |")
    lines.append("| --- | ---: | ---: | ---: | --- |")

    for mid in policy_model_ids:
        info = models.get(mid)
        if info is None:
            lines.append(f"| `{mid}` | ? | ? | ? | ? |")
            continue
        ctx = str(info.context_length or "?")
        lines.append(
            "| "
            + f"`{info.model_id}`"
            + " | "
            + _format_usd_per_million(info.prompt_per_token)
            + " | "
            + _format_usd_per_million(info.completion_per_token)
            + " | "
            + ctx
            + " | "
            + ("yes" if info.supports_structured_outputs else "no")
            + " |"
        )

    lines.append("")
    lines.append("## Max Cost Estimate (per summary)")
    lines.append("")
    lines.append(
        "Assumptions: prompt~=12k tokens (bounded by worker prompt caps), completion capped by tier. "
        "Estimates use the model's prompt+completion pricing from `/api/v1/models`."
    )
    lines.append("")
    lines.append("| Tier | Model | Max completion tokens | Est. max cost |")
    lines.append("| --- | --- | ---: | ---: |")

    for tier, caps in tier_caps.items():
        for mid in policy_model_ids:
            if tier.startswith("daily") and mid not in {
                "deepseek/deepseek-v3.2",
                "google/gemini-2.5-flash-lite",
            }:
                continue
            if tier.startswith("6h") and mid not in {
                "deepseek/deepseek-v3.2",
                "openai/gpt-4o-mini",
                "openai/gpt-4.1-mini",
            }:
                continue
            if tier.startswith("1h") and mid not in {
                "deepseek/deepseek-v3.2",
                "openai/gpt-4.1-mini",
                "openai/gpt-5.2",
                "anthropic/claude-sonnet-4.5",
            }:
                continue

            info = models.get(mid)
            cost = _estimate_max_summary_cost_usd(
                prompt_tokens=assumed_prompt_tokens,
                max_completion_tokens=int(caps["max_completion_tokens"]),
                prompt_per_token=None if info is None else info.prompt_per_token,
                completion_per_token=None if info is None else info.completion_per_token,
            )
            lines.append(
                f"| {tier} | `{mid}` | {caps['max_completion_tokens']} | {_format_usd(cost)} |"
            )

    lines.append("")
    lines.append("## Trending (OpenRouter rankings, best-effort parse)")
    lines.append("")
    if trending:
        for idx, (slug, label) in enumerate(trending, start=1):
            lines.append(f"{idx}. `{slug}`: {label}")
    else:
        lines.append("No models extracted from rankings page (HTML structure may have changed).")

    lines.append("")
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate OpenRouter model pricing/trending report")
    parser.add_argument(
        "--out",
        default="docs/openrouter-model-scout.md",
        help="Output markdown path (default: docs/openrouter-model-scout.md)",
    )
    args = parser.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    build_report(out_path=out_path)


if __name__ == "__main__":
    main()
