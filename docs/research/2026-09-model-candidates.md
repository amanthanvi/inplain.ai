# R2b — Model candidates for the golden-set re-run (2026-09)

Research for issue #35: which models released or repriced since the 2026-08-21
bake-off (`docs/model-eval.md`) belong in a re-run, and is the Anthropic-direct
transport in `inplain/summarize.py` still justified? **No model was called and
nothing was measured.** Every price and capability below comes from a primary
source accessed **2026-09-25** (OpenRouter catalog snapshot 17:40 UTC).

Cost projections use the August volume: 300 summaries/yr × (2,671 input +
1,636 output tokens). Models whose reasoning cannot be turned off will
probably emit more output tokens than that, so treat their $/yr as a lower bound.

## Summary

- **Shortlist: 7 new candidates plus the 3 August controls** (table in §4). One is a
  Claude model (`anthropic/claude-sonnet-5`, the production default and never
  measured). One is a frontier-tier model (`x-ai/grok-4.7`), included for a stated reason.
- **Nothing invalidates the August rubric or its winner.** All 18 measured ids
  are still listed, none has an `expiration_date`, and Google gives
  `gemini-3.7-flash` no shutdown date. Its successor `gemini-3.8-flash` costs
  the same.
- **Two price changes affect the August recommendation:**
  - Gemini 3.7 Flash's default-tier OpenRouter price is now **$0.75/$3.75**, twice
    what August recorded. The $0.375/$1.875 price now exists only on the `flex` tier,
    which is in Preview and runs on best effort. The 2027 figure ($4.88/yr) is unchanged.
  - MiniMax M3's headline price rose 30%. The August price now matches an **fp4** endpoint.
- **Anthropic-direct is not supported by evidence today.** Every generally
  available Claude model is on OpenRouter at Anthropic's list price, with `structured_outputs`.
  Measure Sonnet 5 on the same harness first (§5).

## 1. New since 2026-08-21: considered and excluded

OpenRouter `created` is the date OpenRouter listed the model. Prices are
$/M in / out at the headline (default tier). SO means the model lists
`structured_outputs` (`response_format` with `json_schema`) [a][g].
Shortlisted models appear in §4, not here.

| OpenRouter id | Created | $/M in/out | $/yr | Why not shortlisted |
|---|---|---|---|---|
| anthropic/claude-opus-5.5 | 09-22 | 4 / 20 | 13.02 | Frontier. In August the frontier tier bought nothing. Reasoning is mandatory. Sonnet 5 already answers the Claude question |
| anthropic/claude-fable-5.1 | 09-01 | 10 / 50 | 32.6 | Top frontier tier |
| openai/gpt-6-luna-pro | 09-22 | 0.10 / 0.50 | 0.33 | Same weights as `gpt-6-luna` with `reasoning.mode=pro`. Run only if Luna misses |
| openai/gpt-6-sol, -sol-pro | 09-22 | 2 / 10 | 6.51 | Frontier-adjacent. Terra, its tier in August, gained nothing |
| openai/gpt-6-astra, -astra-pro | 09-04 | 10 / 50 | 32.6 | Flagship tier |
| z-ai/glm-5.3-flash | 08-26 | 0.045 / 0.14 (fp4); 0.15 / 0.50 (Z.AI) | 0.10–0.37 | **First alternate.** The family did poorly in August: `glm-5.3` had 4/17 parse failures, `glm-4.7-flash` had 2/34 and ran 35 s. Reasoning is mandatory, default effort `max`. Z.AI's own endpoint has no SO |
| z-ai/glm-5.3-flashx / -prime | 09-18 / 09-23 | 0.37 / 1.25; 2.8 / 8.8 | — | No SO |
| qwen/qwen3.8-max-0902 / -max-prime | 09-03 / 09-23 | 2 / 6; 4 / 12 | — | Frontier tier |
| qwen/qwen3.8-omni-flash | 09-21 | 0.15 / 0.47 | 0.35 | Audio/video variant of `qwen3.8-flash` |
| meta/muse-spark-1.3 | 09-02 | 1.25 / 4.25 | 3.09 | Mid-to-frontier price, reasoning mandatory, no specific reason to include |
| meta/muse-spark-1.3-contributor | 09-02 | 0.10 / 0.20 | 0.18 | Contributor tier. Its 1.2 version returned 404 on every August call without the account data-sharing opt-in |
| inception/mercury-2.5 | 09-08 | 0.04 / 0.15 | 0.11 | **Second alternate.** A diffusion LLM, an untested architecture class. Its price carries OpenRouter `discount: 0.8` (list price about $0.20/$0.75) |
| cohere/command-a-plus | 09-22 | 0.30 / 1.50 | 0.98 | Reasonable alternate, but no specific evidence for this task |
| upstage/solar-mini4 | 09-23 | 0.05 / 0.20 | 0.14 | 3B active parameters. Price carries `discount: 0.5` |
| deepseek/deepseek-v4-flash-vision-exp | 08-21 | 0.22 / 0.66 | 0.50 | Experimental vision variant |
| inference-net/schematron-v2-small/-turbo | 09-12 | 0.03–0.05 / 0.15–0.23 | — | HTML-to-JSON extractors. Instructions must arrive as a JSON schema, so the golden prompt cannot run unmodified |
| tencent/hy4-preview, ibm-granite/granite-4.2-8b, prism-ml/ternary-bonsai-2-27b, sakana/fugu-*, aion-labs/aion-3.5*, unbiased/pareto, fireworks/ember-1, inclusionai/ling-3.0-* | 08-27…09-24 | — | — | Outside the vendor/tier scope, no SO, or domain-specific (finance, VL) |
| stealth/space-bunny-alpha | 09-23 | free | — | Anonymous stealth model. Not a production candidate |

No new Mistral, MiniMax, Moonshot or Meta-Llama model was listed after 08-21.
(`moonshotai/kimi-k3`, listed 07-16, predates the window.)

## 2. August controls: re-checked

| August id | August price (doc) | Now | Change |
|---|---|---|---|
| google/gemini-3.7-flash | 0.375 / 1.875 (OR, "75% off") | **0.75 / 3.75** on the default tier (`discount: 0.5`). 0.375 / 1.875 **only on the `flex` tier** | Default tier ×2: $1.22 → **$2.44/yr**. The 2027 figure is unchanged |
| minimax/minimax-m3 | 0.23 / 0.96 | **0.30 / 1.20** headline (MiniMax first-party). 0.23 / 0.96 survives only on `coreweave/fp4` | +30%: $0.66 → $0.83/yr |
| qwen/qwen3.7-flash | 0.03 / 0.13 | 0.03 / 0.13, still `response_format` only (no SO) | none |
| deepseek/deepseek-v4-flash-0731 | 0.08 / 0.18 | 0.03 / 0.32 | repriced, $0.15 → $0.18/yr |
| openai/gpt-5.6-luna · x-ai/grok-4.6 · openai/gpt-5.6-terra | as in doc | unchanged | none |

- **The Gemini promo still stands at the source.** Google's page lists
  `gemini-3.7-flash` (and `gemini-3.8-flash`) at $0.75/$3.75 through 2026-12-31
  and $1.50/$7.50 from 2027-01-01. Flex and Batch are half of that on the same
  schedule [c]. Google's Flex tier is **Preview**: "50% cost reduction… in
  exchange for variable latency and best-effort availability" [d].
- On OpenRouter, requests that do not opt in (`service_tier`, `:floor`,
  or a tier slug) "are never routed to a non-default service tier". A `flex`
  request "never falls back to a default-tier endpoint" [e]. A pinned production
  request therefore pays $0.75/$3.75 today.
- OpenRouter's `pricing.discount` is a "fractional discount applied to this
  endpoint's pricing" [h]. On Gemini, `0.5` matches Google's promo exactly.
- Aliases: `~openai/gpt-luna-latest` now resolves to `openai/gpt-6-luna`.
  `~openai/gpt-terra-latest` still resolves to `gpt-5.6-terra`.

## 3. Claude on OpenRouter vs Anthropic direct

Every generally available Claude model is listed; only the limited-access
Mythos models are absent. On the `anthropic` endpoint, OpenRouter
prices match Anthropic's list prices [i][j]. OpenRouter adds no inference
markup and charges 5.5% (min $0.80) on credit purchases [k].

| OpenRouter id | Anthropic API id | OR created | $/M in/out | SO (`anthropic` endpoint) | `temperature` | Thinking | Retirement [l] |
|---|---|---|---|---|---|---|---|
| anthropic/claude-sonnet-5 | `claude-sonnet-5` | 2026-06-30 | 2 / 10 | Y (not on Bedrock) | **N**: non-default values return 400 [m] | adaptive, **on by default** [m] | ≥ 2027-06-30 |
| anthropic/claude-opus-4.8 | `claude-opus-4-8` | 2026-05-27 | 5 / 25 | Y | N | off unless requested | ≥ 2027-05-28 |
| anthropic/claude-opus-5.5 | `claude-opus-5-5` | 2026-09-22 | 4 / 20 | Y | N | always on, default effort `medium` | ≥ 2027-09-22 |
| anthropic/claude-haiku-4.5 | `claude-haiku-4-5-20251001` | 2025-10-15 | 1 / 5 | Y | Y | extended (opt-in) | **≥ 2026-10-15** (3 weeks out) |

- **Sonnet 5's price changed after August.** Anthropic's footnote says the $2/$10
  launch price "is now the standard price. The previously scheduled increase to
  $3/$15… on September 1, 2026 will not occur" [i].
- On the Anthropic API, structured outputs is GA as `output_config.format` for
  every model above [n]. `summarize.py` does not use it.
- The OpenRouter id uses a dot (`anthropic/claude-opus-4.8`). `summarize.py`
  uses the Anthropic hyphen form (`claude-opus-4-8`).
- OpenRouter also serves the Anthropic Messages format at
  `POST /api/v1/messages` with Bearer auth [o]. I did not check whether it
  accepts non-Claude models.

## 4. Shortlist for the re-run

$/yr uses the August volume. The Temp column shows whether the model accepts
`temperature` (the August driver sent 0). SO is Y/N for `structured_outputs`
versus `response_format` only, on the endpoint to pin.

| # | OpenRouter id | Created | $/M in | $/M out | $/yr | SO | Temp | Promo / expiry | Pin (`provider.order`) | Reason |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | google/gemini-3.8-flash | 2026-09-02 | 0.75 | 3.75 | 2.44 (2027: 4.88) | Y | Y (AI Studio only) | **Promo: doubles 2027-01-01** [c] | `google-ai-studio` | Direct successor to the winner at identical price. Decides whether to adopt 3.8 or stay on 3.7 |
| 2 | openai/gpt-6-luna | 2026-09-22 | 0.10 | 0.50 | 0.33 | Y | **N** | none | `openai` | Successor to `gpt-5.6-luna` (99.0%, 5.5 s) at ≤ half its price. Reasoning effort can be set to `none` |
| 3 | qwen/qwen3.8-flash | 2026-08-26 | 0.15 | 0.47 | 0.35 | Y | Y | none | `alibaba` (only provider) | Successor to the value alternate. **Adds `structured_outputs`**, the gap August flagged |
| 4 | deepseek/deepseek-v4.1-flash | 2026-09-10 | 0.15 | 0.60 | 0.41 | N on `deepseek` (RF only); Y on e.g. `fireworks` (0.22/0.66) | Y | some third-party endpoints discounted | `deepseek` | v4-flash had perfect validity but a 124 s call. Tests whether v4.1 keeps the validity with bounded latency |
| 5 | xiaomi/mimo-v2.6-flash | 2026-09-21 | 0.14 | 0.28 | 0.25 | Y | Y | none | `xiaomi` | New vendor, first-party endpoint with SO, optional reasoning. Diversity candidate for the fallback slot |
| 6 | anthropic/claude-sonnet-5 | 2026-06-30 (repriced 09-01) | 2.00 | 10.00 | 6.51 | Y | **N** | intro price made permanent [i] | `anthropic` | **Production default, never measured.** Required to answer the transport question |
| 7 | x-ai/grok-4.7 | 2026-09-21 | 1.60 | 4.80 | 3.64 | Y | Y | none | `xai` | The one frontier probe. It succeeds `grok-4.6`, the only model with 100% coverage, and costs 20% less. Drop it first if trimming |
| C1 | google/gemini-3.7-flash | 2026-08-13 | 0.75 | 3.75 | 2.44 (2027: 4.88) | Y | Y (AI Studio only) | **Promo: doubles 2027-01-01** | `google-ai-studio` | August winner (control) |
| C2 | minimax/minimax-m3 | 2026-05-31 | 0.30 | 1.20 | 0.83 | N on `minimax` (RF only); Y on `coreweave/fp4`, `together` | Y | none | `minimax` or `together` | August fallback (control) |
| C3 | qwen/qwen3.7-flash | 2026-07-27 | 0.03 | 0.13 | 0.09 | N (RF only) | Y | none | `alibaba` | August value alternate (control) |

With C1 as the 2027 worst case, the whole field costs **$0.09–$6.51/yr**, so
August's conclusion holds: cost eliminates nothing.

### Run notes: what the re-run must control that August did not

1. **Pin the provider** (`order` plus `allow_fallbacks: false`) and log the served
   provider for every call. OpenRouter's default routing "load balance[s]…
   prioritizing price", weighted by inverse square of price [f]. For
   `minimax-m3`, the August $0.23/$0.96 price now belongs to an fp4 endpoint.
   The August runs were unpinned, so it is unknown which backend they measured.
2. **Omit `temperature`** for `gpt-6-luna` and `claude-sonnet-5`. Anthropic
   rejects non-default sampling on Sonnet 5 [m]. Never pair `require_parameters: true`
   with `temperature`: that combination leaves those models with no eligible
   endpoint. By default, OpenRouter silently ignores unsupported parameters [f].
3. **Default service tier only.** Do not use `flex` or `:floor` unless flex is the
   thing being tested. Flex requests do not fall back to the default tier [e].
4. Keep `max_tokens` 12000 as August did, and **record reasoning tokens** per model.
   The $/yr column assumes 1,636 output tokens.
5. **Commit the driver.** The committed `eval/run_eval.py` sends only `model`,
   `max_tokens: 4096` and `messages`. It sets no temperature, retries,
   concurrency or `provider` block, so it does not reproduce the method in
   `docs/model-eval.md`. Also, `eval/results/openrouter-bakeoff-2026-08-21.json`
   records `gemini-3.7-flash` as 2 runs with 127 citations and
   `deepseek-v4-flash-0731` as 2 runs with 142 citations. The doc reports 3 runs
   with 188 and 208 citations. Pass 3 is missing from the JSON. Store raw results
   per pass this time.

## 5. Implications

### Is the August rubric or winner invalidated?

**No.** The rubric is a provider-agnostic gate (side-aware verbatim match), and
none of the changes above touches it. No measured model was deprecated or removed.
Google lists `gemini-3.7-flash` with "No shutdown date announced" [p]. Four
changes matter:

| Change | Effect on the August recommendation |
|---|---|
| Gemini 3.7 Flash default-tier price is $0.75/$3.75 on OpenRouter | The "$1.22/yr" line is stale; today's figure is $2.44. The advice to "budget $4.88/yr" stands |
| `gemini-3.8-flash` ships at the same price | Measure it. If it ties, prefer the newer snapshot to push back deprecation risk |
| MiniMax M3 headline +30%; the August price is an fp4 endpoint | Immaterial in dollars ($0.83/yr). Pin the fallback's provider, and note that SO exists only on third-party endpoints |
| `qwen3.8-flash` adds SO | The value alternate's one structural gap has a candidate fix at $0.35/yr |

### Is the Anthropic-direct transport in `summarize.py` justified?

Evidence:

1. **Unmeasured.** No Claude model was in the 18-model field. SPEC §11 made the
   `claude-sonnet-5` pick conditional on "the measured exact-quote citation
   validity rate", which was never produced for it. The comment at
   `summarize.py:96` still attributes the Sonnet 5 choice to
   `docs/model-eval.md`, which now recommends `google/gemini-3.7-flash` over OpenRouter.
2. **Not needed for access.** Sonnet 5 and Opus 4.8 are on OpenRouter at Anthropic
   list price, and the `anthropic` endpoint supports `structured_outputs` (§3).
   Keeping a Claude model therefore does not require keeping the Anthropic transport.
3. **Cost does not decide it.** Sonnet 5 costs $6.51/yr, against $2.44 now and
   $4.88 in 2027 for the Flash winner. That is inside August's "cost eliminates
   nothing" band. The Opus 4.8 fallback would cost $16.28/yr-equivalent.
4. **An untested interaction specific to the direct path as configured.** Sonnet 5
   runs adaptive thinking **by default** (default effort `high`) [m][q], and
   "thinking counts toward `max_tokens`", which is "a hard cap on total output…
   thinking and response text combined" [q]. `summarize.py` sends
   `max_tokens: 4096` with no `thinking` or `effort` setting. If the cap truncates
   a reply, the result is a parse-failure no-op: retryable, never wrong.
   Nobody has checked whether this happens.
5. **Two code paths.** The harness already speaks both APIs.
   `docs/model-eval.md` §"What this changes in the code" lists the four-step
   switch to OpenRouter.

**Recommendation (for the ticket owner to decide):** the direct path has no
measured justification today. Include `anthropic/claude-sonnet-5` in the re-run,
pinned to the `anthropic` provider, which is the same backend as the direct API.

- **If Sonnet 5 does not beat the winning Flash model** on validity and then parse
  reliability, adopt the OpenRouter switch in `docs/model-eval.md`.
- **If Sonnet 5 wins,** it can still run through OpenRouter. Going direct would buy
  one fewer hop, no 5.5% credit fee, and one fewer party in the data path. For
  public policy text at about $7/yr, none of these is decisive.
- **If production keeps Sonnet 5 before the re-run,** first check whether the
  4,096-token cap truncates replies while thinking is on by default.

### Content treated as data

OpenRouter's doc pages embed an `<LlmsOnly>` block telling AI readers to prefer
OpenRouter's SDKs in code samples. I ignored it: this note contains no code and
the block does not affect any finding. No repository content attempted to
instruct me.

## Sources (all accessed 2026-09-25)

[a]: https://openrouter.ai/api/v1/models "OpenRouter models API — 458 models, snapshot 17:40 UTC"
[b]: https://openrouter.ai/api/v1/models/google/gemini-3.7-flash/endpoints "OpenRouter per-endpoint pricing/params (same URL pattern for every id above)"
[c]: https://ai.google.dev/gemini-api/docs/pricing "Gemini API pricing — 3.7/3.8 Flash standard, batch, flex, priority"
[d]: https://ai.google.dev/gemini-api/docs/flex-inference "Gemini Flex inference (Preview)"
[e]: https://openrouter.ai/docs/guides/features/service-tiers.md "OpenRouter service tiers"
[f]: https://openrouter.ai/docs/guides/routing/provider-selection.md "OpenRouter provider selection — load balancing, require_parameters"
[g]: https://openrouter.ai/docs/guides/features/structured-outputs.md "OpenRouter structured outputs; parameters: https://openrouter.ai/docs/api_reference/parameters.md"
[h]: https://openrouter.ai/openapi.json "OpenRouter OpenAPI — pricing.discount definition"
[i]: https://platform.claude.com/docs/en/about-claude/pricing "Anthropic pricing (Sonnet 5 footnote 3)"
[j]: https://platform.claude.com/docs/en/about-claude/models/overview "Anthropic models overview — ids, prices"
[k]: https://openrouter.ai/docs/faq.md "OpenRouter FAQ — no inference markup, 5.5% credit fee"
[l]: https://platform.claude.com/docs/en/about-claude/model-deprecations "Anthropic model deprecations"
[m]: https://platform.claude.com/docs/en/models/sonnet-5/overview "Claude Sonnet 5 — thinking on by default, sampling params 400, $2/$10"
[n]: https://platform.claude.com/docs/en/build-with-claude/structured-outputs "Anthropic structured outputs — supported models"
[o]: https://openrouter.ai/docs/api/api-reference/anthropic-messages/create-a-message.md "OpenRouter Anthropic Messages endpoint"
[p]: https://ai.google.dev/gemini-api/docs/deprecations "Gemini deprecations — release and shutdown dates"
[q]: https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost "Anthropic — thinking counts toward max_tokens"
