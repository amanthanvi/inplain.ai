from celery import Celery

from inplain.settings import settings

celery_app = Celery("inplain", broker=settings.redis_url, backend=settings.redis_url)

celery_app.conf.task_default_queue = "default"
celery_app.conf.task_routes = {
    "inplain.worker.tasks.run_job": {"queue": "fetch"},
}
