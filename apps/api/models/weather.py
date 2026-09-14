from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.session import Base
from apps.api.models.base import UUIDPKMixin


class WeatherCache(Base, UUIDPKMixin):
    __tablename__ = "weather_cache"
    farm_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("farms.id"), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    current_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    forecast_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    farm: Mapped["Farm"] = relationship(back_populates="weather_cache")


from apps.api.models.farm import Farm  # noqa: E402
