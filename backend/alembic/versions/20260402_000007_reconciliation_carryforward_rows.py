"""reconciliation carryforward rows

Revision ID: 20260402_000007
Revises: 20260330_000006
Create Date: 2026-04-02 11:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260402_000007"
down_revision: Union[str, None] = "20260330_000006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bank_transactions",
        sa.Column("reconciliation_session_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "bank_transactions",
        sa.Column("is_carryforward", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_foreign_key(
        "fk_bank_transactions_reconciliation_session_id",
        "bank_transactions",
        "reconciliation_sessions",
        ["reconciliation_session_id"],
        ["id"],
    )
    op.create_index(
        "ix_bank_transactions_reconciliation_session_id",
        "bank_transactions",
        ["reconciliation_session_id"],
        unique=False,
    )

    op.add_column(
        "book_transactions",
        sa.Column("reconciliation_session_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "book_transactions",
        sa.Column("is_carryforward", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_foreign_key(
        "fk_book_transactions_reconciliation_session_id",
        "book_transactions",
        "reconciliation_sessions",
        ["reconciliation_session_id"],
        ["id"],
    )
    op.create_index(
        "ix_book_transactions_reconciliation_session_id",
        "book_transactions",
        ["reconciliation_session_id"],
        unique=False,
    )

    op.alter_column("bank_transactions", "is_carryforward", server_default=None)
    op.alter_column("book_transactions", "is_carryforward", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_book_transactions_reconciliation_session_id", table_name="book_transactions")
    op.drop_constraint(
        "fk_book_transactions_reconciliation_session_id",
        "book_transactions",
        type_="foreignkey",
    )
    op.drop_column("book_transactions", "is_carryforward")
    op.drop_column("book_transactions", "reconciliation_session_id")

    op.drop_index("ix_bank_transactions_reconciliation_session_id", table_name="bank_transactions")
    op.drop_constraint(
        "fk_bank_transactions_reconciliation_session_id",
        "bank_transactions",
        type_="foreignkey",
    )
    op.drop_column("bank_transactions", "is_carryforward")
    op.drop_column("bank_transactions", "reconciliation_session_id")
