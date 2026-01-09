from fastapi import FastAPI

from inplain.api.routes.billing import router as billing_router
from inplain.api.routes.change_events import router as change_events_router
from inplain.api.routes.documents import router as documents_router
from inplain.api.routes.entities import router as entities_router
from inplain.api.routes.health import router as health_router
from inplain.api.routes.me import router as me_router
from inplain.api.routes.webhooks import router as webhooks_router


def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(health_router)
    app.include_router(me_router)
    app.include_router(billing_router)
    app.include_router(entities_router)
    app.include_router(documents_router)
    app.include_router(change_events_router)
    app.include_router(webhooks_router)
    return app
