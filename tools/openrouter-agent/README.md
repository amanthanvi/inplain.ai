# OpenRouter Agent (Dev Tool)

Standalone, dev-only agent scaffold based on OpenRouter's `create-agent` skill.

## Setup

```bash
cd tools/openrouter-agent
npm install
```

## Run (interactive)

```bash
OPENROUTER_API_KEY=... npm run start
```

Optional:
- `OPENROUTER_MODEL=openrouter/auto`

## Run (one-shot: Inplain recommendations)

```bash
OPENROUTER_API_KEY=... npm run start -- --recommend-inplain
```

Notes:
- Never commit API keys.
- This tool is not used by production services.
