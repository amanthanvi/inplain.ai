"""PostHog reverse proxy service.

This exposes PostHog via a single Railway service that binds `$PORT`, while routing:
- UI + dashboard traffic → PostHog Web (fixed port `:8000`)
- ingestion traffic (`/capture/*`, `/e/*`, `/i/*`) → PostHog Capture (fixed port `:3000`)
"""
