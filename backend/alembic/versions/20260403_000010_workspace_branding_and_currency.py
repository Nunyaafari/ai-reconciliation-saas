"""Ensure workspace branding columns and reconciliation currency exist.

Revision ID: 20260403_000010
Revises: 20260402_000009
Create Date: 2026-04-03 10:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260403_000010"
down_revision = "20260402_000009"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("organizations", "company_address"):
        op.add_column(
            "organizations",
            sa.Column("company_address", sa.Text(), nullable=True),
        )
    if not _has_column("organizations", "company_logo_data_url"):
        op.add_column(
            "organizations",
            sa.Column("company_logo_data_url", sa.Text(), nullable=True),
        )
    if not _has_column("reconciliation_sessions", "currency_code"):
        op.add_column(
            "reconciliation_sessions",
            sa.Column("currency_code", sa.String(length=10), nullable=False, server_default="USD"),
        )
        op.execute("UPDATE reconciliation_sessions SET currency_code = 'USD' WHERE currency_code IS NULL")
        op.alter_column("reconciliation_sessions", "currency_code", server_default=None)


def downgrade() -> None:
    if _has_column("reconciliation_sessions", "currency_code"):
        op.drop_column("reconciliation_sessions", "currency_code")
