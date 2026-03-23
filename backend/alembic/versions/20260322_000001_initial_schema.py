"""initial schema

Revision ID: 20260322_000001
Revises:
Create Date: 2026-03-22 21:10:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260322_000001"
down_revision = None
branch_labels = None
depends_on = None


tx_status = sa.Enum("unreconciled", "pending", "matched", name="tx_status")
match_status = sa.Enum("pending", "approved", "rejected", name="match_status")
session_status = sa.Enum(
    "uploaded",
    "extracting",
    "mapping",
    "reconciling",
    "complete",
    "failed",
    name="session_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    tx_status.create(bind, checkfirst=True)
    match_status.create(bind, checkfirst=True)
    session_status.create(bind, checkfirst=True)

    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "ingestion_fingerprints",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_hash", sa.String(length=255), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_source", sa.String(length=50), nullable=False),
        sa.Column("column_map", sa.Text(), nullable=False),
        sa.Column("ai_rules", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Integer(), nullable=False),
        sa.Column("uses_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ingestion_fingerprints_file_hash",
        "ingestion_fingerprints",
        ["file_hash"],
        unique=False,
    )
    op.create_index(
        "ix_ingestion_fingerprints_org_id",
        "ingestion_fingerprints",
        ["org_id"],
        unique=False,
    )

    op.create_table(
        "match_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_type", sa.String(length=10), nullable=False),
        sa.Column("total_bank_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("total_book_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("variance", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("confidence_score", sa.Integer(), nullable=False),
        sa.Column("status", match_status, nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("approved_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_match_groups_org_id", "match_groups", ["org_id"], unique=False)
    op.create_index("ix_match_groups_status", "match_groups", ["status"], unique=False)

    op.create_table(
        "upload_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("file_type", sa.String(length=50), nullable=False),
        sa.Column("upload_source", sa.String(length=50), nullable=False),
        sa.Column("status", session_status, nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("rows_extracted", sa.Integer(), nullable=True),
        sa.Column("rows_standardized", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_upload_sessions_file_hash", "upload_sessions", ["file_hash"], unique=False)
    op.create_index("ix_upload_sessions_org_id", "upload_sessions", ["org_id"], unique=False)
    op.create_index(
        "ix_upload_sessions_org_source_hash",
        "upload_sessions",
        ["org_id", "upload_source", "file_hash"],
        unique=False,
    )
    op.create_index("ix_upload_sessions_status", "upload_sessions", ["status"], unique=False)

    op.create_table(
        "bank_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("upload_session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("trans_date", sa.DateTime(), nullable=False),
        sa.Column("narration", sa.Text(), nullable=False),
        sa.Column("reference", sa.String(length=255), nullable=True),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("match_group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", tx_status, nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["match_group_id"], ["match_groups.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["upload_session_id"], ["upload_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_bank_transactions_match_group_id",
        "bank_transactions",
        ["match_group_id"],
        unique=False,
    )
    op.create_index("ix_bank_transactions_org_id", "bank_transactions", ["org_id"], unique=False)
    op.create_index(
        "ix_bank_transactions_trans_date",
        "bank_transactions",
        ["trans_date"],
        unique=False,
    )

    op.create_table(
        "book_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("upload_session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("trans_date", sa.DateTime(), nullable=False),
        sa.Column("narration", sa.Text(), nullable=False),
        sa.Column("reference", sa.String(length=255), nullable=True),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("match_group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", tx_status, nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["match_group_id"], ["match_groups.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["upload_session_id"], ["upload_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_book_transactions_match_group_id",
        "book_transactions",
        ["match_group_id"],
        unique=False,
    )
    op.create_index("ix_book_transactions_org_id", "book_transactions", ["org_id"], unique=False)
    op.create_index(
        "ix_book_transactions_trans_date",
        "book_transactions",
        ["trans_date"],
        unique=False,
    )

    op.create_table(
        "reconciliation_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_month", sa.String(length=7), nullable=False),
        sa.Column("bank_upload_session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("book_upload_session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("bank_open_balance", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("bank_closing_balance", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("book_open_balance", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("book_closing_balance", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("closed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["bank_upload_session_id"], ["upload_sessions.id"]),
        sa.ForeignKeyConstraint(["book_upload_session_id"], ["upload_sessions.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_reconciliation_sessions_org_id",
        "reconciliation_sessions",
        ["org_id"],
        unique=False,
    )
    op.create_index(
        "ix_reconciliation_sessions_org_period",
        "reconciliation_sessions",
        ["org_id", "period_month"],
        unique=True,
    )
    op.create_index(
        "ix_reconciliation_sessions_period_month",
        "reconciliation_sessions",
        ["period_month"],
        unique=False,
    )
    op.create_index(
        "ix_reconciliation_sessions_status",
        "reconciliation_sessions",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_reconciliation_sessions_status", table_name="reconciliation_sessions")
    op.drop_index("ix_reconciliation_sessions_period_month", table_name="reconciliation_sessions")
    op.drop_index("ix_reconciliation_sessions_org_period", table_name="reconciliation_sessions")
    op.drop_index("ix_reconciliation_sessions_org_id", table_name="reconciliation_sessions")
    op.drop_table("reconciliation_sessions")

    op.drop_index("ix_book_transactions_trans_date", table_name="book_transactions")
    op.drop_index("ix_book_transactions_org_id", table_name="book_transactions")
    op.drop_index("ix_book_transactions_match_group_id", table_name="book_transactions")
    op.drop_table("book_transactions")

    op.drop_index("ix_bank_transactions_trans_date", table_name="bank_transactions")
    op.drop_index("ix_bank_transactions_org_id", table_name="bank_transactions")
    op.drop_index("ix_bank_transactions_match_group_id", table_name="bank_transactions")
    op.drop_table("bank_transactions")

    op.drop_index("ix_upload_sessions_status", table_name="upload_sessions")
    op.drop_index("ix_upload_sessions_org_source_hash", table_name="upload_sessions")
    op.drop_index("ix_upload_sessions_org_id", table_name="upload_sessions")
    op.drop_index("ix_upload_sessions_file_hash", table_name="upload_sessions")
    op.drop_table("upload_sessions")

    op.drop_index("ix_match_groups_status", table_name="match_groups")
    op.drop_index("ix_match_groups_org_id", table_name="match_groups")
    op.drop_table("match_groups")

    op.drop_index("ix_ingestion_fingerprints_org_id", table_name="ingestion_fingerprints")
    op.drop_index("ix_ingestion_fingerprints_file_hash", table_name="ingestion_fingerprints")
    op.drop_table("ingestion_fingerprints")

    op.drop_table("users")

    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_table("organizations")

    bind = op.get_bind()
    session_status.drop(bind, checkfirst=True)
    match_status.drop(bind, checkfirst=True)
    tx_status.drop(bind, checkfirst=True)
