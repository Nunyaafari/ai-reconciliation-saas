"""Add reconciliation report metadata fields.

Revision ID: 20260402_000009
Revises: 20260402_000008
Create Date: 2026-04-02 23:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260402_000009"
down_revision = "20260402_000008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reconciliation_sessions",
        sa.Column("company_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "reconciliation_sessions",
        sa.Column("company_address", sa.Text(), nullable=True),
    )
    op.add_column(
        "reconciliation_sessions",
        sa.Column("company_logo_data_url", sa.Text(), nullable=True),
    )
    op.add_column(
        "reconciliation_sessions",
        sa.Column("prepared_by", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "reconciliation_sessions",
        sa.Column("reviewed_by", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reconciliation_sessions", "reviewed_by")
    op.drop_column("reconciliation_sessions", "prepared_by")
    op.drop_column("reconciliation_sessions", "company_logo_data_url")
    op.drop_column("reconciliation_sessions", "company_address")
    op.drop_column("reconciliation_sessions", "company_name")
