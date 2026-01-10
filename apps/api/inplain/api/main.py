from inplain.observability.sentry import init_sentry
from inplain.api.app import create_app

init_sentry()

app = create_app()
