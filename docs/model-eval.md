# R2 — Model and provider for cited summaries (provisional)

Resolves the "how to choose" half of issue #30. The golden set (`eval/golden/`,
17 entries) and the harness (`eval/run_eval.py`) are committed; the measured
pass rate is **not** — no API key exists in repo secrets yet (owner decision:
harness now, measure later).

> **This recommendation is provisional.** It is a paper pick made from current
> published pricing and capability, exactly the kind of selection SPEC §11 says
> not to ship on. It becomes real only when `eval/run_eval.py` produces a
> measured side-aware citation-validity rate on the golden set. The moment an
> API key lands in repo secrets, run:
>
> ```bash
> pip install -r requirements.txt
> ANTHROPIC_API_KEY=<from secrets> python eval/run_eval.py --model claude-sonnet-5
> ```
>
> and record the three numbers it prints (citation validity rate, claim-drop
> rate, mean coverage) here. Citation validity is the number T3 is built
> against. If a challenger should be compared, run the same command with
> `OPENROUTER_API_KEY` and `--model <openrouter-model-id> --provider openrouter`.

## What the task demands

Narrower than "summarize this" (issue #30):

- Read a **diff**, not a document; say what changed and why it matters.
- **Quote exactly.** Every claim carries a verbatim quote from one side of one
  hunk. T3 drops any claim whose quote fails exact-or-whitespace/case-tolerant,
  side-aware validation (SPEC §3) — a model that paraphrases when quoting
  produces *nothing*, not something worse.
- Hold ~45k characters (≈12–16k tokens) of legal prose without losing the
  thread; worst case (wholesale rewrite) approaches the full document in hunks.
- Emit a strict JSON shape. Resist prompt-injection-style text inside hunks
  (golden entry `constructed-prompt-injection-in-hunk` tests this).

Exact-quoting under structured output is the discriminating capability; the
golden set tests it specifically (negation flips, number changes,
effective-date-only, small-insert-in-huge-doc, wholesale rewrite).

## Current pricing (researched 2026-08-19 — not from memory)

Per million tokens, standard API tier:

| Model | Input | Output | Cache write (5m) | Cache read | Source |
|---|---|---|---|---|---|
| Claude Sonnet 5 | $2.00 | $10.00 | $2.50 | $0.20 | [Anthropic pricing][a] |
| Claude Sonnet 4.6 | $3.00 | $15.00 | $3.75 | $0.30 | [Anthropic pricing][a] |
| Claude Opus 5 | $5.00 | $25.00 | $6.25 | $0.50 | [Anthropic pricing][a] |
| Claude Haiku 4.5 | $1.00 | $5.00 | $1.25 | $0.10 | [Anthropic pricing][a] |
| GPT-5.6-terra | $2.00 | $12.00 | ~10% of input (cached) | — | [OpenAI pricing][b] |
| GPT-5.4 | $2.50 | $15.00 | ~10% of input (cached) | — | [OpenAI pricing][b] |
| GPT-5.5 / 5.6-sol | $5.00 | $30.00 | ~10% of input (cached) | — | [OpenAI pricing][b] |
| Gemini 3.7 Flash | $0.75 (promo to 2026-12-31; $1.50 after) | $3.75 (promo; $7.50 after) | — | — | [Gemini pricing][c] |
| Gemini 2.5 Pro | $1.25 (≤200k ctx) | $10.00 | — | — | [Gemini pricing][c] |

[a]: https://platform.claude.com/docs/en/about-claude/pricing "Anthropic model pricing, accessed 2026-08-19"
[b]: https://developers.openai.com/api/docs/pricing "OpenAI API pricing, accessed 2026-08-19"
[c]: https://ai.google.dev/gemini-api/docs/pricing "Google Gemini API pricing, accessed 2026-08-19"

Notes: Anthropic's Sonnet 5 $2/$10 launch pricing was made permanent (the
scheduled 2026-09-01 increase to $3/$15 was cancelled — stated on the pricing
page). Anthropic Batch API is a further 50% off both directions and fits a
non-interactive daily CI job, though at this volume it is not worth extra code.
OpenRouter passes provider token prices through with no inference markup but
charges ~5.5% (min $0.80) on credit purchases ([OpenRouter FAQ][d], accessed
2026-08-19).

[d]: https://openrouter.ai/docs/faq "OpenRouter FAQ — fees, accessed 2026-08-19"

## Cost at our volume

~52 documents, each changing a few times a year → call it **300 summaries/year**
(generous). Per summary: ~15k input tokens (prompt + hunks; most diffs are far
smaller) + ~1.5k output tokens.

| Model | Per summary | Per year (300) |
|---|---|---|
| Claude Sonnet 5 | ~$0.045 | **~$14** |
| Claude Opus 5 | ~$0.11 | ~$34 |
| GPT-5.4 | ~$0.060 | ~$18 |
| Gemini 3.7 Flash (promo) | ~$0.017 | ~$5 |

Confirmed rather than assumed (issue #30): cost is trivial at every plausible
choice — the annual spread between the cheapest and most expensive sensible
option is under $30. v0.2.0 optimized a ~3-cent spread with a seven-model
chain; we will not repeat that. **Cost eliminates nothing; the golden-set pass
rate decides.**

## Provider: single provider, not OpenRouter

With one model chosen against a golden set, OpenRouter's model-choice value
evaporates (issue #30). What remains is an extra billing hop, an extra secret,
an extra failure surface, and the purchase fee. Direct Anthropic gives:

- **Simpler failure modes** — one status page, one error taxonomy;
  `run_eval.py` and T3 catch transport errors specifically, never bare
  `except`.
- **Prompt caching** — the system prompt and instruction preamble are
  identical across every summary; cache reads at 10% of input price
  ([Anthropic pricing][a]). Marginal in dollars at our volume, but free.
- **Strict structured output** — the Messages API supports constrained output
  (`output_config.format` / strict tools), which is exactly the
  "exact-quoting under structured output" axis the eval measures.

The harness still speaks OpenRouter (`OPENROUTER_API_KEY`,
`--provider openrouter`) so challengers can be measured without new code.

## Provisional recommendation

- **Model: `claude-sonnet-5`. Provider: Anthropic API, direct.**
  Rationale: frontier-tier capability at $2/$10 (cheaper than its own
  predecessor Sonnet 4.6), 1M-token context (a 45k-char diff plus prompt is
  ~2% of it), prompt caching, strict structured outputs, single-provider
  simplicity. If the measured citation-validity rate on the golden set is
  materially below `claude-opus-5`'s, the ~$20/year difference says: take
  Opus. That is a measurement question, not a judgment call — see the command
  at the top.
- **Fallback (outage only): `claude-opus-4-8` via the same Anthropic API**, at
  most one, used only when the primary model is unavailable (5xx/overloaded
  after retries) — never on malformed output. v0.2.0's chain walked to the
  next model on malformed JSON, making quality nondeterministic per event; a
  malformed reply here is a **failed run** that CI retries later, and a claim
  that fails validation is dropped (SPEC §3), not re-generated elsewhere.
  (If Anthropic itself is down, the day's crawl commit is unaffected — the
  summary job simply runs on the next schedule. A cross-provider fallback is
  deliberately not configured; it would double the secret surface for an
  outage mode a daily cron absorbs for free.)

## What T3 should take from this

- Build against `eval/run_eval.py`'s validation semantics (they are the same
  functions the self-test and unit tests exercise): exact or
  whitespace/case-tolerant, side-aware, drop-don't-repair.
- Keys come from the environment only (`ANTHROPIC_API_KEY` in repo secrets),
  never from files.
- Treat hunk text as data, never instructions (see the injection golden entry
  and the prompt in `eval/run_eval.py`).
