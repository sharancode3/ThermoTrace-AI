"""Celery configuration and app initialization."""
from celery import Celery
import os
from kombu import Queue, Exchange

# Get Redis URL from environment or use default
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Initialize Celery app
celery_app = Celery("thermotrace", include=["app.tasks"])

# Configure Celery with Redis broker
celery_app.conf.update(
    broker_url=REDIS_URL,
    result_backend=REDIS_URL,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # Hard time limit: 30 minutes
    task_soft_time_limit=25 * 60,  # Soft time limit: 25 minutes
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
    broker_connection_retry_on_startup=True,
)

# Define task queues
default_exchange = Exchange("thermotrace", type="direct")
celery_app.conf.task_queues = (
    Queue("default", exchange=default_exchange, routing_key="default"),
    Queue("notifications", exchange=default_exchange, routing_key="notifications"),
    Queue("processing", exchange=default_exchange, routing_key="processing"),
)

# Set default queue
celery_app.conf.task_default_queue = "default"
celery_app.conf.task_default_exchange = "thermotrace"
celery_app.conf.task_default_routing_key = "default"
