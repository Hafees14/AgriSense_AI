from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.session import Base
from apps.api.models.base import TimestampMixin, UUIDPKMixin


class Recommendation(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "recommendations"
    farm_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("farms.id"), nullable=False)
    field_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("fields.id"), nullable=True)
    type: Mapped[str] = mapped_column(
        Enum("irrigation", "fertilizer", "harvest", "disease_risk", "general", name="recommendation_type"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(
        Enum("rule_engine", "llm", "expert", name="recommendation_source"), default="rule_engine"
    )
    valid_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    farm: Mapped["Farm"] = relationship(back_populates="recommendations")
    field: Mapped["Field | None"] = relationship(back_populates="recommendations")


from apps.api.models.farm import Farm, Field  # noqa: E402
