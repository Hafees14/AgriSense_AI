"""add farm details: type, crops, address, location_source, image; contact messages

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("farms", sa.Column("location_source", sa.Enum("manual", "gps", "geocoded", name="farm_location_source"), nullable=True))
    op.add_column("farms", sa.Column("address", sa.String(255), nullable=True))
    op.add_column("farms", sa.Column("farm_type", sa.String(80), nullable=True))
    op.add_column("farms", sa.Column("main_crops", sa.String(255), nullable=True))
    op.add_column("farms", sa.Column("image_url", sa.String(500), nullable=True))

    op.create_table(
        "contact_messages",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("contact_messages")
    op.drop_column("farms", "image_url")
    op.drop_column("farms", "main_crops")
    op.drop_column("farms", "farm_type")
    op.drop_column("farms", "address")
    op.drop_column("farms", "location_source")