import time
from typing import Optional

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest


JOB_EVENTS = Counter(
    "reconciliation_job_events_total",
    "Count of processing job lifecycle events",
    ["job_type", "event"],
)

JOB_DURATION = Histogram(
    "reconciliation_job_duration_seconds",
    "Duration of processing jobs",
    ["job_type", "status"],
    buckets=(0.5, 1, 2, 5, 10, 30, 60, 120, 300, 900, 1800),
)

HTTP_REQUEST_DURATION = Histogram(
    "reconciliation_http_request_duration_seconds",
    "API request duration",
    ["method", "path", "status_code"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)


def record_job_event(job_type: str, event: str) -> None:
    JOB_EVENTS.labels(job_type=job_type, event=event).inc()


def record_job_duration(job_type: str, status: str, duration_seconds: float) -> None:
    JOB_DURATION.labels(job_type=job_type, status=status).observe(duration_seconds)


def record_http_request(
    method: str,
    path: str,
    status_code: int,
    duration_seconds: float,
) -> None:
    HTTP_REQUEST_DURATION.labels(
        method=method,
        path=path,
        status_code=str(status_code),
    ).observe(duration_seconds)


def metrics_response() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST


def perf_timer() -> float:
    return time.perf_counter()
