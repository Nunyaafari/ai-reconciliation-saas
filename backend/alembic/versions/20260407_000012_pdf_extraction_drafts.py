"""pdf extraction drafts

Revision ID: 20260407_000012
Revises: 20260403_000011
Create Date: 2026-04-07 12:10:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260407_000012"
down_revision = "20260403_000011"
branch_labels = None
depends_on = None


draft_status = postgresql.ENUM(
    "draft",
    "reviewed",
    "finalized",
    "superseded",
    name="draft_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    draft_status.create(bind, checkfirst=True)

    op.create_table(
        "extraction_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("upload_session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("source_method", sa.String(length=100), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", draft_status, nullable=False, server_default="draft"),
        sa.Column("column_headers_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("mapped_fields_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("raw_rows_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("reviewed_rows_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("validation_summary_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("header_row_index", sa.Integer(), nullable=True),
        sa.Column("table_start_row_index", sa.Integer(), nullable=True),
        sa.Column("table_end_row_index", sa.Integer(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("finalized_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["upload_session_id"], ["upload_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_extraction_drafts_org_id", "extraction_drafts", ["org_id"], unique=False)
    op.create_index(
        "ix_extraction_drafts_upload_session_id",
        "extraction_drafts",
        ["upload_session_id"],
        unique=False,
    )
    op.create_index("ix_extraction_drafts_status", "extraction_drafts", ["status"], unique=False)

    op.create_table(
        "extraction_draft_edits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("draft_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action_type", sa.String(length=100), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["draft_id"], ["extraction_drafts.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_extraction_draft_edits_draft_id",
        "extraction_draft_edits",
        ["draft_id"],
        unique=False,
    )
    op.create_index(
        "ix_extraction_draft_edits_org_id",
        "extraction_draft_edits",
        ["org_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_extraction_draft_edits_org_id", table_name="extraction_draft_edits")
    op.drop_index("ix_extraction_draft_edits_draft_id", table_name="extraction_draft_edits")
    op.drop_table("extraction_draft_edits")

    op.drop_index("ix_extraction_drafts_status", table_name="extraction_drafts")
    op.drop_index("ix_extraction_drafts_upload_session_id", table_name="extraction_drafts")
    op.drop_index("ix_extraction_drafts_org_id", table_name="extraction_drafts")
    op.drop_table("extraction_drafts")

    bind = op.get_bind()
    draft_status.drop(bind, checkfirst=True)
