import logging
import uuid
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi import FastAPI, Request
from contextlib import asynccontextmanager
from app.config import settings
from app.logging_config import setup_logging
from app.observability import metrics_response, perf_timer, record_http_request

# Logging setup
setup_logging(level=settings.LOG_LEVEL, json_logs=settings.LOG_JSON)
logger = logging.getLogger(__name__)


# ===== LIFESPAN EVENTS =====

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    logger.info("Application startup complete for %s environment", settings.APP_ENV)
    yield
    # Shutdown: Cleanup if needed
    logger.info("Shutting down application...")


# ===== CREATE FASTAPI APP =====

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered bank reconciliation API",
    version=settings.VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# ===== MIDDLEWARE =====

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def observability_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    started_at = perf_timer()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        duration = perf_timer() - started_at
        record_http_request(
            request.method,
            request.url.path,
            status_code,
            duration,
        )
        logger.info(
            "HTTP request completed",
            extra={
                "event": "http.request.completed",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": round(duration * 1000, 2),
            },
        )


# ===== EXCEPTION HANDLERS =====

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Handle validation errors."""
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "detail": exc.errors(),
        },
    )


# ===== HEALTH CHECK =====

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
    }


@app.get("/metrics", tags=["Observability"])
async def metrics():
    payload, content_type = metrics_response()
    return Response(content=payload, media_type=content_type)


# ===== INCLUDE ROUTES =====

from app.routes.uploads import router as uploads_router
from app.routes.reconciliation import router as reconciliation_router
from app.routes.organizations import router as organizations_router
from app.routes.jobs import router as jobs_router
from app.routes.auth import router as auth_router
from app.routes.audit import router as audit_router

app.include_router(uploads_router)
app.include_router(reconciliation_router)
app.include_router(organizations_router)
app.include_router(jobs_router)
app.include_router(auth_router)
app.include_router(audit_router)

logger.info(f"FastAPI app initialized: {settings.APP_NAME} v{settings.VERSION}")
