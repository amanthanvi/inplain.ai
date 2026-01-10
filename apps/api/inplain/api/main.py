from inplain.api.app import create_app
from inplain.observability.otel import init_otel, instrument_fastapi
from inplain.observability.sentry import init_sentry

init_sentry()
init_otel()

app = create_app()
instrument_fastapi(app)
