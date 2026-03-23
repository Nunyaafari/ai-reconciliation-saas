"""add job retry fields, audit logs, and password reset tokens

Revision ID: 20260323_000004
Revises: 20260322_000003
Create Date: 2026-03-23 10:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260323_000004"
down_revision = "20260322_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "upload_sessions",
        sa.Column("stored_file_path", sa.String(length=512), nullable=True),
    )

    op.add_column(
        "processing_jobs",
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("job_payload", sa.Text(), nullable=True),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("last_retry_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "processing_jobs",
        sa.Column("dead_lettered_at", sa.DateTime(), nullable=True),
    )
    op.create_foreign_key(
        "fk_processing_jobs_actor_user_id_users",
        "processing_jobs",
        "users",
        ["actor_user_id"],
        ["id"],
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=255), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_org_id", "audit_logs", ["org_id"], unique=False)
    op.create_index(
        "ix_audit_logs_actor_user_id",
        "audit_logs",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index(
        "ix_audit_logs_created_at",
        "audit_logs",
        ["created_at"],
        unique=False,
    )

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        "ix_password_reset_tokens_org_id",
        "password_reset_tokens",
        ["org_id"],
        unique=False,
    )
    op.create_index(
        "ix_password_reset_tokens_user_id",
        "password_reset_tokens",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_password_reset_tokens_expires_at",
        "password_reset_tokens",
        ["expires_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_password_reset_tokens_expires_at",
        table_name="password_reset_tokens",
    )
    op.drop_index(
        "ix_password_reset_tokens_user_id",
        table_name="password_reset_tokens",
    )
    op.drop_index(
        "ix_password_reset_tokens_org_id",
        table_name="password_reset_tokens",
    )
    op.drop_table("password_reset_tokens")

    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_org_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_constraint(
        "fk_processing_jobs_actor_user_id_users",
        "processing_jobs",
        type_="foreignkey",
    )
    op.drop_column("processing_jobs", "dead_lettered_at")
    op.drop_column("processing_jobs", "last_retry_at")
    op.drop_column("processing_jobs", "max_retries")
    op.drop_column("processing_jobs", "attempt_count")
    op.drop_column("processing_jobs", "job_payload")
    op.drop_column("processing_jobs", "actor_user_id")

    op.drop_column("upload_sessions", "stored_file_path")
