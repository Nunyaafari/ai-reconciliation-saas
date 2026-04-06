"""scope reconciliations by account and attach upload recon context

Revision ID: 20260330_000006
Revises: 20260329_000005
Create Date: 2026-03-30 13:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260330_000006"
down_revision = "20260329_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "upload_sessions",
        sa.Column("account_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "upload_sessions",
        sa.Column("period_month", sa.String(length=7), nullable=True),
    )
    op.create_index(
        "ix_upload_sessions_org_account_period",
        "upload_sessions",
        ["org_id", "account_name", "period_month"],
        unique=False,
    )

    op.add_column(
        "reconciliation_sessions",
        sa.Column("account_name", sa.String(length=255), nullable=True),
    )
    op.execute(
        "UPDATE reconciliation_sessions "
        "SET account_name = 'Default Account' "
        "WHERE account_name IS NULL OR account_name = ''"
    )
    op.alter_column("reconciliation_sessions", "account_name", nullable=False)
    op.create_index(
        "ix_reconciliation_sessions_account_name",
        "reconciliation_sessions",
        ["account_name"],
        unique=False,
    )
    op.drop_index(
        "ix_reconciliation_sessions_org_period",
        table_name="reconciliation_sessions",
    )
    op.create_index(
        "ix_reconciliation_sessions_org_account_period",
        "reconciliation_sessions",
        ["org_id", "account_name", "period_month"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_reconciliation_sessions_org_account_period",
        table_name="reconciliation_sessions",
    )
    op.create_index(
        "ix_reconciliation_sessions_org_period",
        "reconciliation_sessions",
        ["org_id", "period_month"],
        unique=True,
    )
    op.drop_index(
        "ix_reconciliation_sessions_account_name",
        table_name="reconciliation_sessions",
    )
    op.drop_column("reconciliation_sessions", "account_name")

    op.drop_index(
        "ix_upload_sessions_org_account_period",
        table_name="upload_sessions",
    )
    op.drop_column("upload_sessions", "period_month")
    op.drop_column("upload_sessions", "account_name")
