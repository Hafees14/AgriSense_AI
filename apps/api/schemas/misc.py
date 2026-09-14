from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatMessageOut(BaseModel):
    role: Literal["user", "assistant"]
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    follow_up_questions: list[str] = []


class WeatherOut(BaseModel):
    farm_id: str
    current: dict[str, Any]
    forecast: list[dict[str, Any]]
    disease_risk: str | None = None
    water_stress: str | None = None
    fetched_at: datetime


class RecommendationOut(BaseModel):
    id: str
    type: str
    content: str
    source: str
    valid_until: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    type: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
