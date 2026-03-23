import json
from typing import Optional

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
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

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

    @property
    def parsed_cors_origins(self) -> list[str]:
        value = self.CORS_ORIGINS
        if isinstance(value, str):
            if value.startswith("["):
                return json.loads(value)
            return [item.strip() for item in value.split(",") if item.strip()]
        return list(value)

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV.lower() == "development"


settings = Settings()
