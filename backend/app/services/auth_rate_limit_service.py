from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque

from redis import Redis

from app.config import settings


class AuthRateLimitService:
    """Redis-first auth rate limiter with an in-memory fallback."""

    def __init__(self) -> None:
        self._local_lock = threading.Lock()
        self._local_windows: dict[str, Deque[float]] = defaultdict(deque)

    def _redis(self) -> Redis:
        return Redis.from_url(settings.REDIS_URL, decode_responses=True)

    def _local_check(
        self,
        *,
        key: str,
        max_attempts: int,
        window_seconds: int,
    ) -> tuple[bool, int]:
        now = time.time()
        cutoff = now - window_seconds
        with self._local_lock:
            bucket = self._local_windows[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            bucket.append(now)
            if len(bucket) <= max_attempts:
                return True, 0
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            return False, retry_after

    def check(
        self,
        *,
        scope: str,
        actor_key: str,
        max_attempts: int,
        window_seconds: int,
    ) -> tuple[bool, int]:
        key = f"auth_rate_limit:{scope}:{actor_key}"
        try:
            redis_client = self._redis()
            count = int(redis_client.incr(key))
            if count == 1:
                redis_client.expire(key, window_seconds)
            if count <= max_attempts:
                return True, 0
            ttl = int(redis_client.ttl(key))
            return False, max(ttl, 1)
        except Exception:
            return self._local_check(
                key=key,
                max_attempts=max_attempts,
                window_seconds=window_seconds,
            )

    def reset(self, *, scope: str, actor_key: str) -> None:
        key = f"auth_rate_limit:{scope}:{actor_key}"
        try:
            self._redis().delete(key)
            return
        except Exception:
            pass
        with self._local_lock:
            self._local_windows.pop(key, None)


auth_rate_limit_service = AuthRateLimitService()
