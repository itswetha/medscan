"""add doctor review status to scans

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003_create_predictions_and_model_versions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scans",
        sa.Column("doctor_review_status", sa.String(length=20), server_default="pending", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("scans", "doctor_review_status")
