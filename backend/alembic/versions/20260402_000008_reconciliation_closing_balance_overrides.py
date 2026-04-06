"""Add manual closing balance overrides to reconciliation sessions.

Revision ID: 20260402_000008
Revises: 20260402_000007
Create Date: 2026-04-02 18:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260402_000008"
down_revision = "20260402_000007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reconciliation_sessions",
        sa.Column("bank_closing_balance_override", sa.Numeric(15, 2), nullable=True),
    )
    op.add_column(
        "reconciliation_sessions",
        sa.Column("book_closing_balance_override", sa.Numeric(15, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reconciliation_sessions", "book_closing_balance_override")
    op.drop_column("reconciliation_sessions", "bank_closing_balance_override")
