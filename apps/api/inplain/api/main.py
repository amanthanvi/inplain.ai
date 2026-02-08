from __future__ import annotations

from fastapi import FastAPI

from inplain.api.routes.health import router as health_router

app = FastAPI(title="inplain-internal-api")
app.include_router(health_router)

