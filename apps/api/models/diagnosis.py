from __future__ import annotations

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.session import Base
from apps.api.models.base import TimestampMixin, UUIDPKMixin


class Diagnosis(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "diagnoses"
    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False)
    field_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("fields.id"), nullable=True)

    diagnosis_type: Mapped[str] = mapped_column(
        Enum("plant_id", "disease", "pest", name="diagnosis_type"), nullable=False
    )
    result_id: Mapped[str | None] = mapped_column(CHAR(36), nullable=True)
    result_label: Mapped[str] = mapped_column(String(150), nullable=False)

    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    heatmap_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    confidence_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    severity: Mapped[str | None] = mapped_column(
        Enum("low", "moderate", "high", "critical", name="diagnosis_severity"), nullable=True
    )
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)

    needs_expert_review: Mapped[bool] = mapped_column(default=False)
    expert_reviewed: Mapped[bool] = mapped_column(default=False)
    expert_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    progress_group_id: Mapped[str | None] = mapped_column(CHAR(36), nullable=True, index=True)

    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)

    user: Mapped["User"] = relationship(back_populates="diagnoses")
    field: Mapped["Field | None"] = relationship(back_populates="diagnoses")


from apps.api.models.user import User  # noqa: E402
from apps.api.models.farm import Field  # noqa: E402
