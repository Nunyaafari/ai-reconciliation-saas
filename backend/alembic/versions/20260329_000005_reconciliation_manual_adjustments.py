"""add transaction removal flags for reconciliation adjustments

Revision ID: 20260329_000005
Revises: 20260323_000004
Create Date: 2026-03-29 22:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260329_000005"
down_revision = "20260323_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bank_transactions",
        sa.Column("is_removed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "bank_transactions",
        sa.Column("removed_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "book_transactions",
        sa.Column("is_removed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "book_transactions",
        sa.Column("removed_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("book_transactions", "removed_at")
    op.drop_column("book_transactions", "is_removed")
    op.drop_column("bank_transactions", "removed_at")
    op.drop_column("bank_transactions", "is_removed")
