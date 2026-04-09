import json
from typing import Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration from environment variables."""

    APP_ENV: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+psycopg://user:password@localhost:5432/reconciliation"
    REDIS_URL: str = "redis://localhost:6379/0"
    UPLOAD_STORAGE_PATH: str = "/app/storage/uploads"

    # API Keys
    OPENAI_API_KEY: Optional[str] = None
    AZURE_AI_KEY: Optional[str] = None
    AZURE_AI_ENDPOINT: Optional[str] = None

    # CORS
    CORS_ORIGINS: str = (
        "http://localhost:3000,"
        "http://localhost:3001,"
        "http://127.0.0.1:3000,"
        "http://127.0.0.1:3001"
    )

    # App
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = True
    APP_NAME: str = "AI Reconciliation SaaS"
    VERSION: str = "0.1.0"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    WEB_CONCURRENCY: int = 2
    FRONTEND_APP_URL: str = "http://localhost:3001"

    # Auth
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    AUTH_BOOTSTRAP_ENABLED: bool = False
    JOB_MAX_RETRIES: int = 3

    # Auth (Placeholder for Clerk integration)
    CLERK_SECRET_KEY: Optional[str] = None

    # Email / Notifications
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "AI Reconciliation SaaS"
    SMTP_USE_STARTTLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_TIMEOUT_SECONDS: int = 15

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("APP_ENV", mode="before")
    @classmethod
    def normalize_app_env(cls, value: str) -> str:
        return str(value or "development").strip().lower()

    @property
    def parsed_cors_origins(self) -> list[str]:
        value = self.CORS_ORIGINS
        if isinstance(value, str):
            if value.startswith("["):
                return json.loads(value)
            return [item.strip() for item in value.split(",") if item.strip()]
        return list(value)

    @model_validator(mode="after")
    def validate_production_guardrails(self) -> "Settings":
        if not self.is_production:
            return self

        errors: list[str] = []
        weak_secret_values = {
            "",
            "change-me-in-production",
            "dev-secret-change-me",
            "replace-with-long-random-secret",
        }
        if (
            not self.JWT_SECRET_KEY
            or self.JWT_SECRET_KEY.strip().lower() in weak_secret_values
            or len(self.JWT_SECRET_KEY.strip()) < 32
        ):
            errors.append(
                "JWT_SECRET_KEY must be set to a strong secret (at least 32 characters) in production."
            )

        if self.DEBUG:
            errors.append("DEBUG must be false in production.")

        if self.AUTH_BOOTSTRAP_ENABLED:
            errors.append("AUTH_BOOTSTRAP_ENABLED must be false in production.")

        localhost_markers = ("localhost", "127.0.0.1")
        if any(marker in (self.FRONTEND_APP_URL or "").lower() for marker in localhost_markers):
            errors.append("FRONTEND_APP_URL cannot point to localhost in production.")

        if any(
            any(marker in origin.lower() for marker in localhost_markers)
            for origin in self.parsed_cors_origins
        ):
            errors.append("CORS_ORIGINS cannot contain localhost origins in production.")

        if errors:
            raise ValueError(" ".join(errors))

        return self

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV.lower() == "development"


settings = Settings()
