from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application configuration from environment variables."""

    # Database
    DATABASE_URL: str = "postgresql+psycopg://user:password@localhost:5432/reconciliation"

    # API Keys
    OPENAI_API_KEY: Optional[str] = None
    AZURE_AI_KEY: Optional[str] = None
    AZURE_AI_ENDPOINT: Optional[str] = None

    # CORS
    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:3001"]

    # App
    DEBUG: bool = True
    APP_NAME: str = "AI Reconciliation SaaS"
    VERSION: str = "0.1.0"

    # Auth (Placeholder for Clerk integration)
    CLERK_SECRET_KEY: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
