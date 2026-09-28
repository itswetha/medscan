"""create doctor review workflow table

Revision ID: 0005
Revises: 0004
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "doctor_reviews",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("scan_id", sa.Uuid(as_uuid=True), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("decision", sa.String(length=40), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("scan_id", name="uq_doctor_reviews_scan_id"),
        sa.CheckConstraint("status IN ('pending', 'completed')", name="ck_doctor_reviews_status"),
        sa.CheckConstraint(
            "decision IS NULL OR decision IN ('agree', 'disagree', 'needs_further_evaluation')",
            name="ck_doctor_reviews_decision",
        ),
    )
    op.create_index("ix_doctor_reviews_requested_by", "doctor_reviews", ["requested_by"])
    op.create_index("ix_doctor_reviews_reviewed_by", "doctor_reviews", ["reviewed_by"])
    op.create_index("ix_doctor_reviews_status_requested_at", "doctor_reviews", ["status", "requested_at"])


def downgrade() -> None:
    op.drop_index("ix_doctor_reviews_status_requested_at", table_name="doctor_reviews")
    op.drop_index("ix_doctor_reviews_reviewed_by", table_name="doctor_reviews")
    op.drop_index("ix_doctor_reviews_requested_by", table_name="doctor_reviews")
    op.drop_table("doctor_reviews")
