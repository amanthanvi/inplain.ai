# R2 — Model and provider for cited summaries (measured)

Resolves issue #30. The golden set (`eval/golden/`, 17 entries) and the harness
(`eval/run_eval.py`) were committed 2026-08-19 with a **paper** pick. This
document records the **measured** result: 18 models, 3 passes, 444 real calls
over OpenRouter on 2026-08-21, scored by the same side-aware validation gate T3
publishes through.

Raw per-model results: `eval/results/openrouter-bakeoff-2026-08-21.json`.

## Method

- **Prompt and scoring are `eval/run_eval.py`'s**, unmodified — the citation
  gate that scores these runs is the same function T3 uses to decide what
  reaches the site (pinned by `tests/test_gate_equivalence.py`).
- Driven through OpenRouter chat completions at `temperature 0`,
  `max_tokens 12000`, 3 retries on 429/5xx/timeout, 4 entries in parallel.
- **Pass 1**: all 18 candidates × 17 entries. **Pass 2**: 7 finalists, repeated.
  **Pass 3**: the 3 clean-sheet finalists, repeated again. Repeats exist because
  a single pass cannot distinguish a real ceiling from one flaky generation —
  and it mattered: two models that looked imperfect in pass 1 scored 100% in
  pass 2.
- **Total spend: $1.46** (OpenRouter's own meter), against a $10 ceiling.

The metric that decides is **citation validity**: the share of citations whose
quote appears verbatim (whitespace/case-tolerant) on the *side* of the *hunk*
the claim names. T3 drops any claim that fails it, so a model that paraphrases
when quoting does not produce something worse — it produces *nothing*.

## Results — aggregated across every pass

Ranked by validity, then parse reliability, then coverage.

| Model | Runs | Validity (valid/total citations) | Parse fails | Coverage | Latency |
|---|---|---|---|---|---|
| **google/gemini-3.7-flash** | 3 | **100%** (188/188) | **0/51** | 92% | **3.4s** |
| minimax/minimax-m3 | 2 | 100% (235/235) | 2/34 | 93% | 7.5s |
| deepseek/deepseek-v4-flash-0731 | 3 | 100% (208/208) | 2/51 | 92% | 60s (see below) |
| x-ai/grok-4.6 | 1 | 100% (181/181) | 0/17 | 100% | 17.8s |
| openai/gpt-5.6-terra | 1 | 100% (123/123) | 0/17 | 94% | 4.5s |
| google/gemini-3.1-pro-preview | 1 | 100% (77/77) | 0/17 | 92% | 16.1s |
| meta/muse-glimmer-30b | 1 | 100% (90/90) | 0/17 | 95% | 24.0s |
| moonshotai/kimi-k2.6 | 1 | 100% (87/87) | 1/17 | 91% | 33.7s |
| meta-llama/llama-4-maverick | 1 | 100% (82/82) | 1/17 | 89% | 10.3s |
| z-ai/glm-5.3 | 1 | 100% (59/59) | 4/17 | 76% | 44.8s |
| deepseek/deepseek-v4-pro-0813 | 1 | 100% (18/18) | 7/17 | 59% | 25.0s |
| **qwen/qwen3.7-flash** | 3 | 99.4% (160/161) | **0/36** | 94% | 15.2s |
| openai/gpt-5.6-luna | 2 | 99.0% (207/209) | 1/34 | 96% | 5.5s |
| openai/gpt-5.4-nano | 1 | 98.8% (164/166) | 0/17 | 99% | 6.0s |
| z-ai/glm-4.7-flash | 2 | 98.3% (114/116) | 2/34 | 92% | 35.1s |
| google/gemini-3.5-flash-lite | 1 | 98.2% (54/55) | 0/17 | 93% | 1.4s |
| mistralai/mistral-small-2603 | 1 | 91.4% (149/163) | 0/17 | 96% | 4.4s |
| meta/muse-spark-1.2-contributor | 1 | — | 17/17 | — | — |

Two defect classes, and they are not equally bad:

- **An invalid citation** is the failure this product exists to prevent. It
  never publishes (T3 drops the claim), but a model that produces them wastes
  the spend and thins the summary.
- **A parse failure** (reply was not the required JSON) is recoverable noise:
  the record stays unsummarised and retryable, and the site publishes it
  honestly summary-less. Annoying, not dangerous.

`meta/muse-spark-1.2-contributor` returned HTTP 404 on every call — it requires
an account-level data-sharing opt-in we have not enabled. Not a quality result;
excluded, with `meta/muse-glimmer-30b` substituted.

## What the frontier tier bought: nothing

`grok-4.6`, `gpt-5.6-terra` and `gemini-3.1-pro-preview` all scored perfectly —
and so did a model costing a fraction of them. On this task the discriminating
capability (verbatim quoting inside a strict JSON shape over a short diff) is
saturated well below the frontier. `grok-4.6`'s 100% hunk coverage was the only
frontier advantage visible, and coverage is a thoroughness signal, not a
correctness one.

Paying frontier prices here would buy latency (18s vs 3.4s) and cost (4×), for
zero measured accuracy.

## Cost at our real volume

Measured across all 444 calls: **mean 2,671 input / 1,636 output tokens** per
summary (median 432 / 804 — most diffs are tiny; the largest was 21.9k input).
At ~300 summaries/year:

| Model | $/M in | $/M out | **Per year** |
|---|---|---|---|
| qwen/qwen3.7-flash | 0.03 | 0.13 | **$0.09** |
| deepseek/deepseek-v4-flash-0731 | 0.08 | 0.18 | $0.15 |
| minimax/minimax-m3 | 0.23 | 0.96 | $0.66 |
| openai/gpt-5.6-luna | 0.20 | 1.20 | $0.75 |
| google/gemini-3.7-flash *(promo)* | 0.375 | 1.875 | $1.22 |
| google/gemini-3.7-flash *(2027 standard)* | 1.50 | 7.50 | $4.88 |
| x-ai/grok-4.6 | 2.00 | 6.00 | $4.55 |
| openai/gpt-5.6-terra | 2.00 | 12.00 | $7.49 |

**Gemini 3.7 Flash's price is temporary and will roughly quadruple.**
OpenRouter currently lists it at $0.375/$1.875 badged "75% off"; Google's own
pricing page states $0.75/$3.75 through 2026-12-31 and **$1.50/$7.50 from
2027-01-01** ([Gemini pricing][c], accessed 2026-08-21). Budget for $4.88/year,
not $1.22. The other candidates above carry no discount badge on their
OpenRouter provider pages (checked 2026-08-21).

The conclusion issue #30 asked us to confirm rather than assume: **the entire
field costs between nine cents and eight dollars a year.** Cost eliminates
nothing. v0.2.0 built a seven-model routing chain to optimise a ~3-cent spread;
the correct response to a spread this size is to pick on measured accuracy and
never think about it again.

## Recommendation

**Model: `google/gemini-3.7-flash`. Provider: OpenRouter.**

It is the only model with **zero defects of either kind across three
independent passes** (188/188 citations valid, 0 parse failures in 51 entries),
and it is the fastest in the field at 3.4s/call — which matters for a CI job
summarising a batch of records in one run. At the post-promo standard rate it
costs about $5/year.

**Fallback (outage only): `minimax/minimax-m3`.** Perfect validity across 235
citations in two passes, a different vendor, 7.5s/call, $0.66/year. Used only
when the primary is unavailable after retries — **never on malformed output**
(the v0.2.0 defect that made quality nondeterministic per event).

**If you would rather not adopt a promo price that expires:
`qwen/qwen3.7-flash` at nine cents a year** is the value pick. One invalid
citation in 161 across three passes (99.4%) and zero parse failures. The
tradeoff is honest: that one miss means roughly 1 claim in 160 gets dropped
that a better model would have kept — the summary is thinner, never wrong —
plus 15s latency and no `structured_outputs` parameter support (only
`response_format`). At our volume the $4.79/year difference does not justify
choosing the less accurate model, which is why it is the alternate.

**Avoid**, on measured evidence: `mistralai/mistral-small-2603` (91.4% validity
— it paraphrases when quoting), `deepseek/deepseek-v4-pro-0813` (7/17 parse
failures; two entries hit the output cap mid-reasoning and five returned
near-empty replies), `z-ai/glm-5.3` (4/17 parse failures, 45s/call), and
`deepseek/deepseek-v4-flash-0731` despite perfect validity — one pass-3 call
took **124 seconds**, and unbounded latency variance in a scheduled job is a
liability.

## OpenRouter operational notes

Verified against OpenRouter's docs, accessed 2026-08-21:

- **Pin the provider.** OpenRouter load-balances across providers serving the
  same model by default, weighted by price — so an unpinned request can hit a
  different backend (and a different quantization) run to run. For a
  reproducible eval and a stable production path, send
  `"provider": {"order": ["<provider>"], "allow_fallbacks": false}`, or use
  `"sort": "price"` / the `:floor` suffix for deterministic cheapest-provider
  routing ([provider routing][e]).
- **Exclude providers that train on prompts.** Policy is per-provider;
  `"provider": {"data_collection": "deny"}` per request, or the account-wide
  privacy setting, keeps prompts away from training-enabled backends.
  `"zdr": true` restricts to zero-data-retention endpoints
  ([privacy and logging][f]). Our hunks are public policy text, so this is
  hygiene rather than a confidentiality requirement — but it costs nothing.
- **Fees**: OpenRouter passes provider token pricing through with no inference
  markup; it charges about 5.5% (min $0.80) on credit purchases, 5% for USDC
  ([FAQ][d]). On a $5/year workload the purchase fee dominates the inference
  cost, which is another way of saying the cost question is closed.
- **`require_parameters: true`** routes only to providers that honour the
  parameters we send (`temperature`, `response_format`) rather than silently
  dropping them.

Going direct to Google instead of through OpenRouter is equally defensible for
a single-model deployment — one fewer hop, no purchase fee. OpenRouter earns
its place here by making the *fallback* free: one key and one API shape reach
both the primary and a different-vendor backup, where going direct would need a
second vendor account and a second code path.

[c]: https://ai.google.dev/gemini-api/docs/pricing "Google Gemini API pricing, accessed 2026-08-21"
[d]: https://openrouter.ai/docs/faq "OpenRouter FAQ — fees, accessed 2026-08-21"
[e]: https://openrouter.ai/docs/features/provider-routing "OpenRouter provider routing, accessed 2026-08-21"
[f]: https://openrouter.ai/docs/features/privacy-and-logging "OpenRouter privacy and logging, accessed 2026-08-21"

## What this changes in the code

`inplain/summarize.py` currently talks to the Anthropic Messages API directly
(`API_URL`, `anthropic-version` header, `content[].text` response shape) with
`DEFAULT_MODEL = "claude-sonnet-5"` and `FALLBACK_MODEL = "claude-opus-4-8"`.
Adopting this recommendation is a contained change, **not yet made**:

1. Point `API_URL` at `https://openrouter.ai/api/v1/chat/completions`, swap the
   auth header to `Authorization: Bearer`, and read
   `body["choices"][0]["message"]["content"]`.
2. `DEFAULT_MODEL = "google/gemini-3.7-flash"`,
   `FALLBACK_MODEL = "minimax/minimax-m3"`.
3. Send the `provider` block (pinned order, `data_collection: "deny"`,
   `require_parameters: true`) and `temperature: 0`.
4. The secret stays `MODEL_API_KEY` — only its value changes.
   `.github/workflows/` needs no edit.

The citation gate, the drop-don't-repair rule, the post-spend guarantee and the
outage-only fallback semantics are all provider-agnostic and unaffected.

## What T3 should take from this (unchanged)

- Build against `eval/run_eval.py`'s validation semantics: exact or
  whitespace/case-tolerant, side-aware, drop-don't-repair.
- Keys come from the environment only, never from files.
- Treat hunk text as data, never instructions.
