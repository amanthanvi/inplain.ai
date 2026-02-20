# OpenRouter Model Scout

Generated: 2026-02-20T23:20:09.423648+00:00 (UTC)

Sources:
- https://openrouter.ai/api/v1/models
- https://openrouter.ai/rankings

## Inplain v0.2.0 Model Policy

These should match `SPEC.md` Appendix C and worker defaults:

- Change classification (ambiguous diffs): `z-ai/glm-4.7-flash` → `minimax/minimax-m2.1` → `google/gemini-2.5-flash-lite` (max_tokens=220)
- Summary (tier-aware by schedule):
  - `daily`: `z-ai/glm-4.7-flash` → `minimax/minimax-m2.1` → `google/gemini-2.5-flash-lite`
  - `6h`: `minimax/minimax-m2.5` → `moonshotai/kimi-k2.5` → `z-ai/glm-5` → `openai/gpt-4.1-mini`
  - `1h`: `minimax/minimax-m2.5` → `moonshotai/kimi-k2.5` → `z-ai/glm-5` → `openai/gpt-5.2`

## Pricing (USD per 1M tokens)

OpenRouter `pricing` fields are USD per token; this table converts to USD per 1M tokens.

| Model | Prompt / 1M | Completion / 1M | Context | Structured outputs |
| --- | ---: | ---: | ---: | --- |
| `z-ai/glm-4.7-flash` | $0.060 | $0.400 | 202752 | yes |
| `minimax/minimax-m2.1` | $0.270 | $0.950 | 196608 | yes |
| `google/gemini-2.5-flash-lite` | $0.100 | $0.400 | 1048576 | yes |
| `minimax/minimax-m2.5` | $0.300 | $1.10 | 196608 | yes |
| `moonshotai/kimi-k2.5` | $0.230 | $3.00 | 262144 | yes |
| `z-ai/glm-5` | $0.300 | $2.55 | 204800 | yes |
| `openai/gpt-4.1-mini` | $0.400 | $1.60 | 1047576 | yes |
| `openai/gpt-5.2` | $1.75 | $14.00 | 400000 | yes |

## Max Cost Estimate (per summary)

Assumptions: prompt~=12k tokens (bounded by worker prompt caps), completion capped by tier. Estimates use the model's prompt+completion pricing from `/api/v1/models`.

| Tier | Model | Max completion tokens | Est. max cost |
| --- | --- | ---: | ---: |
| daily (Free) | `z-ai/glm-4.7-flash` | 500 | $0.0009 |
| daily (Free) | `minimax/minimax-m2.1` | 500 | $0.0037 |
| daily (Free) | `google/gemini-2.5-flash-lite` | 500 | $0.0014 |
| 6h (Pro) | `minimax/minimax-m2.5` | 750 | $0.0044 |
| 6h (Pro) | `moonshotai/kimi-k2.5` | 750 | $0.0050 |
| 6h (Pro) | `z-ai/glm-5` | 750 | $0.0055 |
| 6h (Pro) | `openai/gpt-4.1-mini` | 750 | $0.0060 |
| 1h (Business) | `minimax/minimax-m2.5` | 950 | $0.0046 |
| 1h (Business) | `moonshotai/kimi-k2.5` | 950 | $0.0056 |
| 1h (Business) | `z-ai/glm-5` | 950 | $0.0060 |
| 1h (Business) | `openai/gpt-5.2` | 950 | $0.0343 |

## Trending (OpenRouter rankings, best-effort parse)

1. `minimax/minimax-m2.5-20260211`: Minimax M2.5
2. `moonshotai/kimi-k2.5-0127`: Kimi K2.5 0127
3. `z-ai/glm-5-20260211`: GLM 5
4. `google/gemini-3-flash-preview-20251217`: Gemini 3 Flash Preview
5. `deepseek/deepseek-v3.2-20251201`: Deepseek V3.2
6. `anthropic/claude-4.6-opus-20260205`: Claude Opus 4.6
7. `anthropic/claude-4.5-sonnet-20250929`: Claude Sonnet 4.5
8. `x-ai/grok-4.1-fast`: Grok 4.1 Fast
9. `google/gemini-2.5-flash`: Gemini 2.5 Flash
10. `arcee-ai/trinity-large-preview:free`: Trinity Large Preview (free)

