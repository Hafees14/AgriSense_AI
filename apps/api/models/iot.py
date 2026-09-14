from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.session import Base
from apps.api.models.base import UUIDPKMixin


class SensorReading(Base, UUIDPKMixin):
    __tablename__ = "sensor_readings"
    field_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("fields.id"), nullable=False)
    sensor_type: Mapped[str] = mapped_column(
        Enum("soil_moisture", "ph", "ec", "temperature", "humidity", name="sensor_type"), nullable=False
    )
    value: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    field: Mapped["Field"] = relationship(back_populates="sensor_readings")


from apps.api.models.farm import Field  # noqa: E402
