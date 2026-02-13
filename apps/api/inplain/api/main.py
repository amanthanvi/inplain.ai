from __future__ import annotations

from fastapi import Depends, FastAPI

from inplain.api.deps import require_internal_service_token
from inplain.api.errors import install_error_handlers
from inplain.api.routes.health import router as health_router
from inplain.api.routes.internal_admin import router as internal_admin_router
from inplain.api.routes.internal_change_events import router as internal_change_events_router
from inplain.api.routes.internal_documents import router as internal_documents_router
from inplain.api.routes.internal_entities import router as internal_entities_router
from inplain.api.routes.internal_export import router as internal_export_router
from inplain.api.routes.internal_notifications import router as internal_notifications_router
from inplain.api.routes.internal_snapshots import router as internal_snapshots_router
from inplain.api.routes.internal_usage import router as internal_usage_router
from inplain.api.routes.internal_webhooks import router as internal_webhooks_router
from inplain.telemetry import init_telemetry

app = FastAPI(title="inplain-internal-api")
init_telemetry(service="api")
install_error_handlers(app)
app.include_router(health_router)

internal_deps = [Depends(require_internal_service_token)]
app.include_router(internal_entities_router, prefix="/internal", dependencies=internal_deps)
app.include_router(internal_export_router, prefix="/internal", dependencies=internal_deps)
app.include_router(internal_documents_router, prefix="/internal", dependencies=internal_deps)
app.include_router(internal_change_events_router, prefix="/internal", dependencies=internal_deps)
app.include_router(internal_notifications_router, prefix="/internal", dependencies=internal_deps)
app.include_router(internal_snapshots_router, prefix="/internal", dependencies=internal_deps)
app.include_router(internal_usage_router, prefix="/internal", dependencies=internal_deps)
app.include_router(internal_webhooks_router, prefix="/internal")
app.include_router(internal_admin_router, prefix="/internal", dependencies=internal_deps)
