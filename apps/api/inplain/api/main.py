from inplain.api.app import create_app
from inplain.observability.sentry import init_sentry

init_sentry()

app = create_app()
