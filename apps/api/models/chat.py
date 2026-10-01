from __future__ import annotations

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.session import Base
from apps.api.models.base import TimestampMixin, UUIDPKMixin


class ChatMessage(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "chat_history"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    role: Mapped[str] = mapped_column(Enum("user", "assistant", name="chat_role"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship(back_populates="chat_messages")


from apps.api.models.user import User  # noqa: E402
