"""Celery application factory for background tasks."""
from celery import Celery
from app.core.config import settings

celery_app = Celery("english_ai")
celery_app.conf.broker_url = settings.REDIS_URL
celery_app.conf.result_backend = settings.REDIS_URL
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.task_acks_late = True
celery_app.conf.worker_prefetch_multiplier = 1
celery_app.autodiscover_tasks(["app.tasks"])
