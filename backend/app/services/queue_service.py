from redis import Redis
from rq import Queue

from app.config import settings

QUEUE_NAME = "reconciliation"


def get_redis_connection() -> Redis:
    return Redis.from_url(settings.REDIS_URL)


def get_queue() -> Queue:
    return Queue(QUEUE_NAME, connection=get_redis_connection())
