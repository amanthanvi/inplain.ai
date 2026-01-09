from fastapi import FastAPI

from inplain.api.routes.entities import router as entities_router
from inplain.api.routes.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(health_router)
    app.include_router(entities_router)
    return app
