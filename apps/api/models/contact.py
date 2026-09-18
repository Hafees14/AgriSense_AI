from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from apps.api.db.session import Base
from apps.api.models.base import TimestampMixin, UUIDPKMixin


class ContactMessage(Base, UUIDPKMixin, TimestampMixin):
    """A message submitted through the public /contact form. No user_id —
    the sender doesn't need an account to reach the team."""

    __tablename__ = "contact_messages"
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)