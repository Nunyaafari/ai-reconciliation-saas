from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.config import settings
from app.database.models import Base
from app.database import engine
import logging

# Logging setup
logging.basicConfig(level=logging.INFO if settings.DEBUG else logging.WARNING)
logger = logging.getLogger(__name__)


# ===== LIFESPAN EVENTS =====

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Startup: Create tables
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
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
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


# ===== INCLUDE ROUTES =====

from app.routes.uploads import router as uploads_router
from app.routes.reconciliation import router as reconciliation_router
from app.routes.organizations import router as organizations_router

app.include_router(uploads_router)
app.include_router(reconciliation_router)
app.include_router(organizations_router)

logger.info(f"FastAPI app initialized: {settings.APP_NAME} v{settings.VERSION}")
