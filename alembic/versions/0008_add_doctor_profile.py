"""add nullable doctor profile fields

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("specialization", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("years_experience", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("bio", sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "bio")
    op.drop_column("users", "years_experience")
    op.drop_column("users", "specialization")
