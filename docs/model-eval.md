# R2 — Model and provider for cited summaries (measured)

Resolves issue #30. The golden set (`eval/golden/`, 17 entries) and the harness
(`eval/run_eval.py`) were committed 2026-08-19 with a **paper** pick. This
document records the **measured** result: 18 models, 3 passes, 444 real calls
over OpenRouter on 2026-08-21, scored by the same side-aware validation gate T3
publishes through.

Raw per-model results: `eval/results/openrouter-bakeoff-2026-08-21.json`.

## 2026-10-24 re-measure on the production prompt: the pick stands

Audit #40 item 4, accepted by the owner. The harness no longer has its own
prompt or gate: `eval/run_eval.py` imports `SYSTEM_PROMPT`, `build_prompt`,
`select_hunks` (the 45,000-character Hunk budget), `parse_bullets`,
`review_bullets`, `MAX_OUTPUT_TOKENS`, `NO_TEMPERATURE`, `REQUEST_TIMEOUT` and
the shipped provider pins from `inplain/summarize.py`, and a test holds its
request byte-equal to `OpenRouterClient`'s for both shipped models. Each golden
entry is sent as production would send that record: the system prompt, the
Company's display name, the nonce fence, and the budgeted Hunk prefix with its
partial-coverage note. Citations are scored against the Hunks the model was
shown. Everything else is September's method (temperature 0, 3 retries, 4-way
parallel, provider pinned with fallbacks off, plus `data_collection: deny` as
production sends it). The four clean finalists from September were measured:
passes 1 and 2 on all four, and pass 3 on the three still clean after two
passes. 187 calls, no call failures, every call served by the pinned
provider. Raw results: `eval/results/openrouter-production-prompt-2026-10/`.
The calls ran before #84 added the whole-word quote rule to the gate. All 187
stored replies were then re-scored with the stricter gate, and every score
is identical.

| Model | Runs | Validity (valid/total citations) | Parse fails | Coverage (of all / of shown Hunks) | Mean latency (median, max) | Cost measured | $/yr at 300 summaries |
|---|---|---|---|---|---|---|---|
| `x-ai/grok-4.7` | 3 | **100.0%** (502/502) | 0/51 | 92.1% / 96.9% | 21.5s (6.7s, 157s) | $0.942 | $5.54 |
| `google/gemini-3.8-flash` | 3 | **100.0%** (187/187) | 0/51 | 87.5% / 92.3% | 5.7s (4.0s, 16s) | $0.203 | $1.19 |
| `google/gemini-3.7-flash` | 3 | **100.0%** (180/180) | 0/51 | 87.0% / 91.8% | 6.6s (4.4s, 21s) | $0.231 | $1.36 |
| `qwen/qwen3.7-flash` | 2 | **99.4%** (164/165) | 0/34 | 87.4% / 92.2% | 24.4s (18.8s, 73s) | $0.015 | $0.13 |

- **Coverage is lower than September for everyone, mostly because of the
  budget.** The Stripe golden entry (110k characters) now sends 2 of its 11
  Hunks, as production would, so no model can cover more than 2/11 of it.
  Coverage of the Hunks shown is in the second figure. The ranking is
  unchanged: Grok is about five points ahead of the field.
- `qwen/qwen3.7-flash` produced one invalid citation (pass 2,
  `constructed-negation-sell-to-share`: one of a claim's two quotes failed, so
  that claim was dropped). It therefore missed pass 3, as in September's method.
- Grok's slowest call took 157 s (September: 136 s). That is still inside
  `summarize.py`'s 300 s request timeout.
- Grok's output grew to about 2,440 tokens a call, 1,870 of them reasoning,
  so its yearly cost estimate rose from $4.18 to $5.54. This time Gemini ran
  on OpenRouter's own credits (`is_byok: false` on every call), not on an
  attached Google key, so its cost is on OpenRouter's meter.

**By the rubric (validity, then parse reliability, then coverage, then
latency), the winner and the fallback do not change: primary `x-ai/grok-4.7`,
outage fallback `google/gemini-3.8-flash`.** On the production prompt the
fallback no longer needs September's judgement call: Gemini 3.8 Flash ranks
above 3.7 on both coverage and latency, and Qwen drops out on validity. No
model id in `summarize.py` was changed.

Spend: OpenRouter key usage went from $1.6425 to $3.7864 ($2.14), against a
$3 cap. That includes a 2-entry smoke test of each model. The per-call costs
recorded in the pass files add up to $1.39. The rest of the meter movement is
not explained by these calls: none was retried, and every reported cost equals
its upstream cost.

## 2026-09-27 re-run: the measured pick is `x-ai/grok-4.7`, fallback `google/gemini-3.8-flash`

Resolves issue #36 and closes the "provisional" status SPEC §11 carried since
August. Seven candidates released or repriced since the August bake-off
(`docs/research/2026-09-model-candidates.md`) and the three August controls
were measured on the same harness, brought up to the August method first
(PR #47): temperature 0 (omitted for `openai/gpt-6-luna` and
`anthropic/claude-sonnet-5`, which reject non-default sampling), 12,000 max
tokens, 3 retries, 4-way parallel, and **the provider pinned per model with
fallbacks off**, with the served provider recorded on every call. Raw results
per pass: `eval/results/openrouter-bakeoff-2026-09/pass{1,2,3}.json`, plus
`aggregate.json`. Total spend: **$1.33 on OpenRouter's meter plus about
$1.13 billed by Google directly**, because the two Gemini models ran on the
Google API key attached to the owner's OpenRouter account (`is_byok: true`
in the results); about $2.46 in all, against the $10 ceiling. The same
applies in production: the Gemini fallback works only while that Google key
stays attached to the OpenRouter account whose key is `MODEL_API_KEY`.

Passes: pass 1 on all ten; pass 2 on the eight with no parse failure and at
least 99% validity; pass 3 on the four with a clean sheet after two passes.

| Model | Runs | Validity (valid/total citations) | Parse fails | Coverage | Mean latency | $/yr at 300 summaries |
|---|---|---|---|---|---|---|
| `x-ai/grok-4.7` | 3 | **100.0%** (528/528) | 0/51 | 99.6% | 18.2s | $4.18 |
| `qwen/qwen3.7-flash` | 3 | **100.0%** (209/209) | 0/51 | 94.3% | 30.7s | $0.14 |
| `google/gemini-3.7-flash` | 3 | **100.0%** (197/197) | 0/51 | 92.2% | 3.7s | $1.51 |
| `google/gemini-3.8-flash` | 3 | **100.0%** (198/198) | 0/51 | 92.1% | 4.7s | $1.82 |
| `qwen/qwen3.8-flash` | 1 | **100.0%** (93/93) | 2/17 | 88.2% | 41.1s | $0.56 |
| `deepseek/deepseek-v4.1-flash` | 2 | **99.6%** (262/263) | 0/34 | 99.4% | 29.5s | $0.64 |
| `anthropic/claude-sonnet-5` | 2 | **99.6%** (228/229) | 0/34 | 97.5% | 8.0s | $4.98 |
| `openai/gpt-6-luna` | 2 | **99.5%** (219/220) | 0/34 | 96.6% | 5.7s | $0.17 |
| `xiaomi/mimo-v2.6-flash` | 2 | **98.7%** (374/379) | 0/34 | 99.2% | 19.2s | $0.19 |
| `minimax/minimax-m3` | 1 | **95.2%** (120/126) | 1/17 | 90.5% | 11.3s | $0.81 |

Notes on the field:

- `x-ai/grok-4.7` was the only model with **zero defects of either kind over
  three passes and 528 citations** while also citing 99.6% of Hunks. Its mean
  latency hides a long tail: median 4.5 s, slowest call 136 s. That is inside
  the crawl's 30-minute budget for a day's records, and `summarize.py`'s
  request timeout is 300 s so one slow call is not misread as an outage.
- `google/gemini-3.8-flash` and `google/gemini-3.7-flash` were equally clean
  and are the fastest in the field (medians around 3 s), but cover about 92%
  of Hunks: the summaries are thinner. 3.8 is preferred over 3.7 as the newer
  snapshot at the same price. Google's promo price doubles on 2027-01-01.
- `qwen/qwen3.7-flash` was clean again (as in August, near enough) at nine
  cents a year, but takes 30 s a call with 2,500 reasoning tokens and offers
  no structured outputs.
- `anthropic/claude-sonnet-5`, the provisional production default since
  August, measured 228/229 with no parse failures: good, but not better than
  the winners, and the most expensive. This settles the transport question:
  Anthropic-direct had no measured justification, and production now runs
  through OpenRouter.
- `deepseek/deepseek-v4.1-flash` could not be served by DeepSeek's own
  endpoint: the account's no-training guardrail removes it, and with
  fallbacks off there is no endpoint. Re-measured pinned to Fireworks:
  262/263, slow (29.5 s mean). `xiaomi/mimo-v2.6-flash` has the widest
  coverage after Grok but five invalid citations. `minimax/minimax-m3`, the
  August fallback, dropped to 95.2% on its now-pinned first-party endpoint.

Decision, by the August rubric (validity, then parse reliability, then
coverage, then latency; cost only breaks near-ties): **primary
`x-ai/grok-4.7` pinned to `xai`; outage-only fallback
`google/gemini-3.8-flash` pinned to `google-ai-studio`.** Cost did not enter:
the whole field costs $0.14 to $4.98 a year, and Grok's $4.18 is below
Gemini's 2027 price.

One caveat the audit (#40, item 4) raised and this run did not fix: the
harness scored its own single-turn prompt, with no Hunk budget, while
production sends a system prompt, a fenced user turn over the budgeted Hunks
and a per-Claim keep rule. The per-Citation gate was the same (then pinned by
a test that pinned two copies together), so validity transfers; the coverage
and latency figures are indicative. The owner accepted aligning the harness;
see the production-prompt re-measure below.

Made by the lead under the owner's delegation (2026-09-27). Provisional until
the cutover: comment `veto` on #36 to reverse.

## Method

- **Prompt and scoring were `eval/run_eval.py`'s own** for the August and
  September runs: a single-turn prompt, every Hunk sent, and a copy of the
  citation gate that a test pinned to the one T3 publishes through. The
  harness now imports the prompt, the Hunk budget and the gate from
  `inplain/summarize.py` (see the production-prompt re-measure), so those
  earlier figures were measured on a prompt production never sent.
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
- **`require_parameters` is not sent.** It would route only to providers that
  honour every parameter in the request, but paired with `temperature` it
  leaves models that reject sampling parameters no endpoint. Instead each
  model is pinned to one provider (`provider.order`, fallbacks off), and
  `temperature` is left out for the models that reject it (`NO_TEMPERATURE`
  in `inplain/summarize.py`).

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

**Made on 2026-09-27 (issue #36).** As written in August, `inplain/summarize.py` talked to the Anthropic Messages API directly
(`API_URL`, `anthropic-version` header, `content[].text` response shape) with
`DEFAULT_MODEL = "claude-sonnet-5"` and `FALLBACK_MODEL = "claude-opus-4-8"`.
Adopting the measured pick was a contained change:

1. Point `API_URL` at `https://openrouter.ai/api/v1/chat/completions`, swap the
   auth header to `Authorization: Bearer`, and read
   `body["choices"][0]["message"]["content"]`.
2. `DEFAULT_MODEL = "x-ai/grok-4.7"`,
   `FALLBACK_MODEL = "google/gemini-3.8-flash"` (the 2026-09-27 re-run above supersedes August's pair).
3. Send the `provider` block (pinned order, fallbacks off, `data_collection: "deny"`)
   and `temperature: 0`. `require_parameters` is never sent: paired with
   `temperature` it leaves models that reject sampling parameters no endpoint.
4. The secret stays `MODEL_API_KEY` — only its value changes.
   `.github/workflows/` needs no edit.

The citation gate, the drop-don't-repair rule, the post-spend guarantee and the
outage-only fallback semantics are all provider-agnostic and unaffected.

## What T3 should take from this (unchanged)

- The validation semantics are `inplain/summarize.py`'s, and the harness
  scores with them: exact or whitespace/case-tolerant, side-aware,
  drop-don't-repair.
- Keys come from the environment only, never from files.
- Treat hunk text as data, never instructions.
