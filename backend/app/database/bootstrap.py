import logging

from sqlalchemy import inspect, text

from app.database import engine
from app.database.models import Base

logger = logging.getLogger(__name__)


def determine_bootstrap_state() -> str:
    """
    Prepare legacy databases for Alembic management.

    States:
    - managed: alembic_version exists, safe to run upgrade
    - legacy: existing app tables were created outside Alembic; sync and stamp
    - fresh: no app tables exist yet; run full Alembic upgrade
    """
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    app_tables = set(Base.metadata.tables.keys())

    if "alembic_version" in table_names:
        logger.info("Alembic metadata table already present")
        return "managed"

    if table_names.intersection(app_tables):
        logger.warning(
            "Legacy schema detected without Alembic metadata; syncing schema before stamping"
        )
        Base.metadata.create_all(bind=engine)

        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE upload_sessions "
                    "ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64)"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE upload_sessions "
                    "ADD COLUMN IF NOT EXISTS stored_file_path VARCHAR(512)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_upload_sessions_file_hash "
                    "ON upload_sessions (file_hash)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_upload_sessions_org_source_hash "
                    "ON upload_sessions (org_id, upload_source, file_hash)"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"
                )
            )
            connection.execute(
                text("UPDATE users SET password_hash = '' WHERE password_hash IS NULL")
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ALTER COLUMN password_hash SET NOT NULL"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"
                )
            )
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email "
                    "ON users (email)"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE processing_jobs "
                    "ADD COLUMN IF NOT EXISTS actor_user_id UUID"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE processing_jobs "
                    "ADD COLUMN IF NOT EXISTS job_payload TEXT"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE processing_jobs "
                    "ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE processing_jobs "
                    "ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE processing_jobs "
                    "ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE processing_jobs "
                    "ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMP"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_processing_jobs_org_id "
                    "ON processing_jobs (org_id)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_processing_jobs_upload_session_id "
                    "ON processing_jobs (upload_session_id)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_processing_jobs_status "
                    "ON processing_jobs (status)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_processing_jobs_job_type "
                    "ON processing_jobs (job_type)"
                )
            )

        return "legacy"

    logger.info("No existing application tables detected; fresh migration path")
    return "fresh"


if __name__ == "__main__":
    print(determine_bootstrap_state())
