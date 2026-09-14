from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.session import Base
from apps.api.models.base import TimestampMixin, UUIDPKMixin


class Farm(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "farms"
    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    land_size_ha: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)

    user: Mapped["User"] = relationship(back_populates="farms")
    fields: Mapped[list["Field"]] = relationship(back_populates="farm", cascade="all, delete-orphan")
    weather_cache: Mapped[list["WeatherCache"]] = relationship(back_populates="farm", cascade="all, delete-orphan")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="farm", cascade="all, delete-orphan")


class Field(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "fields"
    farm_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("farms.id"), nullable=False)
    crop_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("plants.id"), nullable=True)
    planting_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_harvest_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    area_ha: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("planned", "growing", "harvested", "fallow", name="field_status"), default="planned"
    )

    farm: Mapped["Farm"] = relationship(back_populates="fields")
    crop: Mapped["Plant | None"] = relationship()
    diagnoses: Mapped[list["Diagnosis"]] = relationship(back_populates="field")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="field")
    sensor_readings: Mapped[list["SensorReading"]] = relationship(back_populates="field", cascade="all, delete-orphan")


from apps.api.models.user import User  # noqa: E402
from apps.api.models.plant import Plant  # noqa: E402
from apps.api.models.diagnosis import Diagnosis  # noqa: E402
from apps.api.models.weather import WeatherCache  # noqa: E402
from apps.api.models.recommendation import Recommendation  # noqa: E402
from apps.api.models.iot import SensorReading  # noqa: E402
