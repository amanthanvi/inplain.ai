# Railway

TBD (v0.1.0): deployment notes + env templates.

Planned services (SPEC v0.2.0):

- `web` (public) — Next.js
- `api` (private) — FastAPI internal service
- `worker` (private) — Python worker (scheduler + job executor)
- `postgres` — DB + job queue
- `redis` — cache only (robots.txt decisions; not a queue)

