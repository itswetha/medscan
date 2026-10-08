"""assign doctor reviews to selected doctors

Revision ID: 0009_assign_doctor
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_assign_doctor"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "doctor_reviews",
        sa.Column("assigned_doctor_id", sa.Uuid(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_doctor_reviews_assigned_doctor_id_users",
        "doctor_reviews",
        "users",
        ["assigned_doctor_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_doctor_reviews_assigned_doctor_id",
        "doctor_reviews",
        ["assigned_doctor_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_doctor_reviews_assigned_doctor_id", table_name="doctor_reviews")
    op.drop_constraint("fk_doctor_reviews_assigned_doctor_id_users", "doctor_reviews", type_="foreignkey")
    op.drop_column("doctor_reviews", "assigned_doctor_id")
