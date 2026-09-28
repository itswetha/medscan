"""create predictions and model_versions tables

Revision ID: 0003_create_predictions_and_model_versions
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_create_predictions_and_model_versions"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.String(length=100), nullable=False, unique=True),
        sa.Column("model_path", sa.String(length=1024), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_model_versions_id", "model_versions", ["id"])

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scan_id", sa.Uuid(as_uuid=True), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_version_id", sa.Integer(), sa.ForeignKey("model_versions.id"), nullable=False),
        sa.Column("normal_probability", sa.Float(), nullable=False),
        sa.Column("pneumonia_probability", sa.Float(), nullable=False),
        sa.Column("tuberculosis_probability", sa.Float(), nullable=False),
        sa.Column("other_probability", sa.Float(), nullable=False),
        sa.Column("ai_confidence", sa.Float(), nullable=False),
        sa.Column("gradcam_path", sa.String(length=1024), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_predictions_id", "predictions", ["id"])
    op.create_index("ix_predictions_scan_id", "predictions", ["scan_id"], unique=True)
    op.create_index("ix_predictions_model_version_id", "predictions", ["model_version_id"])


def downgrade() -> None:
    op.drop_index("ix_predictions_model_version_id", table_name="predictions")
    op.drop_index("ix_predictions_scan_id", table_name="predictions")
    op.drop_index("ix_predictions_id", table_name="predictions")
    op.drop_table("predictions")
    op.drop_index("ix_model_versions_id", table_name="model_versions")
    op.drop_table("model_versions")
