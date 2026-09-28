"""create scans table

Revision ID: 0002
Revises: 0001_create_users
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001_create_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    quality_status = postgresql.ENUM("good", "poor", name="scan_quality_status")
    quality_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "scans",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("patient_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("quality_score", sa.Integer(), nullable=False),
        sa.Column("quality_status", postgresql.ENUM("good", "poor", name="scan_quality_status", create_type=False), nullable=False),
        sa.Column("quality_issues", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("user_continued_anyway", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_scans_patient_id", "scans", ["patient_id"])


def downgrade() -> None:
    op.drop_index("ix_scans_patient_id", table_name="scans")
    op.drop_table("scans")
    postgresql.ENUM("good", "poor", name="scan_quality_status").drop(op.get_bind(), checkfirst=True)
