"""add optional doctor profile photo storage path

Revision ID: 0010_doctor_profile_photo
Revises: 0009_assign_doctor
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_doctor_profile_photo"
down_revision = "0009_assign_doctor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_photo_path", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_photo_path")
