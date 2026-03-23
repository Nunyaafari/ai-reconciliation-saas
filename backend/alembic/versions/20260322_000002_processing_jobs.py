"""add processing jobs table

Revision ID: 20260322_000002
Revises: 20260322_000001
Create Date: 2026-03-22 23:05:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260322_000002"
down_revision = "20260322_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "processing_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("upload_session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("progress_percent", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(length=255), nullable=True),
        sa.Column("result_payload", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["upload_session_id"], ["upload_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_processing_jobs_job_type",
        "processing_jobs",
        ["job_type"],
        unique=False,
    )
    op.create_index(
        "ix_processing_jobs_org_id",
        "processing_jobs",
        ["org_id"],
        unique=False,
    )
    op.create_index(
        "ix_processing_jobs_status",
        "processing_jobs",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_processing_jobs_upload_session_id",
        "processing_jobs",
        ["upload_session_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_processing_jobs_upload_session_id", table_name="processing_jobs")
    op.drop_index("ix_processing_jobs_status", table_name="processing_jobs")
    op.drop_index("ix_processing_jobs_org_id", table_name="processing_jobs")
    op.drop_index("ix_processing_jobs_job_type", table_name="processing_jobs")
    op.drop_table("processing_jobs")
