# OpenRouter Model Scout

Generated: 2026-02-13T00:56:58.433883+00:00 (UTC)

Sources:
- https://openrouter.ai/api/v1/models
- https://openrouter.ai/rankings

## Inplain v0.2.0 Model Policy

These should match `SPEC.md` Appendix C and worker defaults:

- Change classification (ambiguous diffs): `deepseek/deepseek-v3.2` → `google/gemini-3-flash-preview` (max_tokens=220)
- Summary (tier-aware by schedule):
  - `daily`: `deepseek/deepseek-v3.2` → `google/gemini-3-flash-preview`
  - `6h`: `deepseek/deepseek-v3.2` → `google/gemini-3-flash-preview` → `openai/gpt-5.2`
  - `1h`: `deepseek/deepseek-v3.2` → `openai/gpt-5.2` → `anthropic/claude-sonnet-4.5`

## Pricing (USD per 1M tokens)

OpenRouter `pricing` fields are USD per token; this table converts to USD per 1M tokens.

| Model | Prompt / 1M | Completion / 1M | Context | Structured outputs |
| --- | ---: | ---: | ---: | --- |
| `deepseek/deepseek-v3.2` | $0.250 | $0.380 | 163840 | yes |
| `google/gemini-3-flash-preview` | $0.500 | $3.00 | 1048576 | yes |
| `openai/gpt-5.2` | $1.75 | $14.00 | 400000 | yes |
| `anthropic/claude-sonnet-4.5` | $3.00 | $15.00 | 1000000 | yes |

## Max Cost Estimate (per summary)

Assumptions: prompt~=12k tokens (bounded by worker prompt caps), completion capped by tier. Estimates use the model's prompt+completion pricing from `/api/v1/models`.

| Tier | Model | Max completion tokens | Est. max cost |
| --- | --- | ---: | ---: |
| daily (Free) | `deepseek/deepseek-v3.2` | 650 | $0.0032 |
| daily (Free) | `google/gemini-3-flash-preview` | 650 | $0.0080 |
| 6h (Pro) | `deepseek/deepseek-v3.2` | 850 | $0.0033 |
| 6h (Pro) | `google/gemini-3-flash-preview` | 850 | $0.0086 |
| 6h (Pro) | `openai/gpt-5.2` | 850 | $0.0329 |
| 1h (Business) | `deepseek/deepseek-v3.2` | 1100 | $0.0034 |
| 1h (Business) | `openai/gpt-5.2` | 1100 | $0.0364 |
| 1h (Business) | `anthropic/claude-sonnet-4.5` | 1100 | $0.0525 |

## Trending (OpenRouter rankings, best-effort parse)

1. `moonshotai/kimi-k2.5-0127`: Kimi K2.5 0127
2. `google/gemini-3-flash-preview-20251217`: Gemini 3 Flash Preview
3. `deepseek/deepseek-v3.2-20251201`: Deepseek V3.2
4. `anthropic/claude-4.5-sonnet-20250929`: Claude Sonnet 4.5
5. `x-ai/grok-4.1-fast`: Grok 4.1 Fast
6. `minimax/minimax-m2.1`: Minimax M2.1
7. `google/gemini-2.5-flash`: Gemini 2.5 Flash
8. `anthropic/claude-4.6-opus-20260205`: Claude Opus 4.6
9. `arcee-ai/trinity-large-preview:free`: Trinity Large Preview (free)
10. `google/gemini-2.5-flash-lite`: Gemini 2.5 Flash Lite

