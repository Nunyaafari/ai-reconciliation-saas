"""Add reconciliation account numbers and set default currency to GHS.

Revision ID: 20260403_000011
Revises: 20260403_000010
Create Date: 2026-04-03 15:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260403_000011"
down_revision = "20260403_000010"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("reconciliation_sessions", "account_number"):
        op.add_column(
            "reconciliation_sessions",
            sa.Column("account_number", sa.String(length=100), nullable=True),
        )

    op.alter_column(
        "reconciliation_sessions",
        "currency_code",
        existing_type=sa.String(length=10),
        server_default="GHS",
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "reconciliation_sessions",
        "currency_code",
        existing_type=sa.String(length=10),
        server_default="USD",
        existing_nullable=False,
    )
    if _has_column("reconciliation_sessions", "account_number"):
        op.drop_column("reconciliation_sessions", "account_number")
