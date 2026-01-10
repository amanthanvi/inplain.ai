from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from inplain.api.ratelimit import RateLimitMiddleware
from inplain.api.routes.admin import router as admin_router
from inplain.api.routes.billing import router as billing_router
from inplain.api.routes.change_events import router as change_events_router
from inplain.api.routes.documents import router as documents_router
from inplain.api.routes.entities import router as entities_router
from inplain.api.routes.health import router as health_router
from inplain.api.routes.me import router as me_router
from inplain.api.routes.notification_preferences import router as notification_preferences_router
from inplain.api.routes.unsubscribe import router as unsubscribe_router
from inplain.api.routes.webhooks import router as webhooks_router
from inplain.settings import settings


def create_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    if settings.cors_allow_origins:
        origins = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
        if origins:
            app.add_middleware(
                CORSMiddleware,
                allow_origins=origins,
                allow_credentials=True,
                allow_methods=["*"],
                allow_headers=["*"],
            )

    app.include_router(health_router)
    app.include_router(me_router)
    app.include_router(billing_router)
    app.include_router(notification_preferences_router)
    app.include_router(unsubscribe_router)
    app.include_router(admin_router)
    app.include_router(entities_router)
    app.include_router(documents_router)
    app.include_router(change_events_router)
    app.include_router(webhooks_router)
    return app
