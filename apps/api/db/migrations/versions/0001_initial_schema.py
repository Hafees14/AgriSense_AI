"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("name", sa.String(30), unique=True, nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("language_pref", sa.String(10), nullable=False, server_default="en"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("role_id", mysql.CHAR(36), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "sessions",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("user_id", mysql.CHAR(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(255), nullable=False),
        sa.Column("device_info", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("revoked", sa.Boolean, nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "farms",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("user_id", mysql.CHAR(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("land_size_ha", sa.Numeric(8, 2), nullable=True),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "plants",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("scientific_name", sa.String(150), nullable=False),
        sa.Column("common_name", sa.String(150), nullable=False),
        sa.Column("category", sa.String(80), nullable=True),
        sa.Column("cultivation_info", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_plants_common_name", "plants", ["common_name"])

    op.create_table(
        "diseases",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("causes", sa.Text, nullable=True),
        sa.Column("organic_treatment", sa.Text, nullable=True),
        sa.Column("chemical_treatment", sa.Text, nullable=True),
        sa.Column("prevention_tips", sa.Text, nullable=True),
        sa.Column("severity_scale", sa.Enum("low", "moderate", "high", "critical", name="disease_severity_scale"), nullable=False, server_default="moderate"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_diseases_name", "diseases", ["name"])

    op.create_table(
        "pests",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("risk_level", sa.Enum("low", "moderate", "high", "critical", name="pest_risk_level"), nullable=False, server_default="moderate"),
        sa.Column("life_cycle", sa.Text, nullable=True),
        sa.Column("damage_description", sa.Text, nullable=True),
        sa.Column("treatment", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pests_name", "pests", ["name"])

    op.create_table(
        "disease_plants",
        sa.Column("disease_id", mysql.CHAR(36), sa.ForeignKey("diseases.id"), primary_key=True),
        sa.Column("plant_id", mysql.CHAR(36), sa.ForeignKey("plants.id"), primary_key=True),
    )

    op.create_table(
        "fields",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("farm_id", mysql.CHAR(36), sa.ForeignKey("farms.id"), nullable=False),
        sa.Column("crop_id", mysql.CHAR(36), sa.ForeignKey("plants.id"), nullable=True),
        sa.Column("planting_date", sa.Date, nullable=True),
        sa.Column("expected_harvest_date", sa.Date, nullable=True),
        sa.Column("area_ha", sa.Numeric(8, 2), nullable=True),
        sa.Column("status", sa.Enum("planned", "growing", "harvested", "fallow", name="field_status"), nullable=False, server_default="planned"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "diagnoses",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("user_id", mysql.CHAR(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("field_id", mysql.CHAR(36), sa.ForeignKey("fields.id"), nullable=True),
        sa.Column("diagnosis_type", sa.Enum("plant_id", "disease", "pest", name="diagnosis_type"), nullable=False),
        sa.Column("result_id", mysql.CHAR(36), nullable=True),
        sa.Column("result_label", sa.String(150), nullable=False),
        sa.Column("image_url", sa.String(500), nullable=False),
        sa.Column("heatmap_url", sa.String(500), nullable=True),
        sa.Column("confidence_score", sa.Numeric(5, 4), nullable=False),
        sa.Column("severity", sa.Enum("low", "moderate", "high", "critical", name="diagnosis_severity"), nullable=True),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("needs_expert_review", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("expert_reviewed", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("expert_notes", sa.Text, nullable=True),
        sa.Column("progress_group_id", mysql.CHAR(36), nullable=True),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_diagnoses_progress_group_id", "diagnoses", ["progress_group_id"])

    op.create_table(
        "recommendations",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("farm_id", mysql.CHAR(36), sa.ForeignKey("farms.id"), nullable=False),
        sa.Column("field_id", mysql.CHAR(36), sa.ForeignKey("fields.id"), nullable=True),
        sa.Column("type", sa.Enum("irrigation", "fertilizer", "harvest", "disease_risk", "general", name="recommendation_type"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("source", sa.Enum("rule_engine", "llm", "expert", name="recommendation_source"), nullable=False, server_default="rule_engine"),
        sa.Column("valid_until", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "weather_cache",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("farm_id", mysql.CHAR(36), sa.ForeignKey("farms.id"), nullable=False),
        sa.Column("fetched_at", sa.DateTime, nullable=False),
        sa.Column("current_json", sa.JSON, nullable=False),
        sa.Column("forecast_json", sa.JSON, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "chat_history",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("user_id", mysql.CHAR(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("session_id", mysql.CHAR(36), nullable=False),
        sa.Column("role", sa.Enum("user", "assistant", name="chat_role"), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chat_history_session_id", "chat_history", ["session_id"])

    op.create_table(
        "notifications",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("user_id", mysql.CHAR(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("type", sa.Enum("diagnosis_result", "outbreak_alert", "weather_alert", "system", name="notification_type"), nullable=False, server_default="system"),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "sensor_readings",
        sa.Column("id", mysql.CHAR(36), primary_key=True),
        sa.Column("field_id", mysql.CHAR(36), sa.ForeignKey("fields.id"), nullable=False),
        sa.Column("sensor_type", sa.Enum("soil_moisture", "ph", "ec", "temperature", "humidity", name="sensor_type"), nullable=False),
        sa.Column("value", sa.Numeric(10, 4), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("recorded_at", sa.DateTime, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("sensor_readings")
    op.drop_table("notifications")
    op.drop_table("chat_history")
    op.drop_table("weather_cache")
    op.drop_table("recommendations")
    op.drop_table("diagnoses")
    op.drop_table("fields")
    op.drop_table("disease_plants")
    op.drop_table("pests")
    op.drop_table("diseases")
    op.drop_table("plants")
    op.drop_table("farms")
    op.drop_table("sessions")
    op.drop_table("users")
    op.drop_table("roles")
