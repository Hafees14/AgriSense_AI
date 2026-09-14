from __future__ import annotations

from sqlalchemy import JSON, Enum, ForeignKey, String, Table, Text, Column
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.session import Base
from apps.api.models.base import TimestampMixin, UUIDPKMixin

disease_plants = Table(
    "disease_plants",
    Base.metadata,
    Column("disease_id", CHAR(36), ForeignKey("diseases.id"), primary_key=True),
    Column("plant_id", CHAR(36), ForeignKey("plants.id"), primary_key=True),
)


class Plant(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "plants"
    scientific_name: Mapped[str] = mapped_column(String(150), nullable=False)
    common_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cultivation_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    diseases: Mapped[list["Disease"]] = relationship(secondary=disease_plants, back_populates="plants")


class Disease(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "diseases"
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    causes: Mapped[str | None] = mapped_column(Text, nullable=True)
    organic_treatment: Mapped[str | None] = mapped_column(Text, nullable=True)
    chemical_treatment: Mapped[str | None] = mapped_column(Text, nullable=True)
    prevention_tips: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity_scale: Mapped[str] = mapped_column(
        Enum("low", "moderate", "high", "critical", name="disease_severity_scale"), default="moderate"
    )
    plants: Mapped[list["Plant"]] = relationship(secondary=disease_plants, back_populates="diseases")


class Pest(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "pests"
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    risk_level: Mapped[str] = mapped_column(
        Enum("low", "moderate", "high", "critical", name="pest_risk_level"), default="moderate"
    )
    life_cycle: Mapped[str | None] = mapped_column(Text, nullable=True)
    damage_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    treatment: Mapped[str | None] = mapped_column(Text, nullable=True)
