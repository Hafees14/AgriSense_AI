from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


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


class ContactMessageCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    subject: str = Field(min_length=2, max_length=200)
    message: str = Field(min_length=10, max_length=5000)


class ContactMessageOut(BaseModel):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


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


class OutbreakHotspot(BaseModel):
    """A clustered, anonymized cell — never an individual farmer's exact
    location or identity. latitude/longitude are the centroid of a rounded
    grid cell (~1.1 km), and report_count is the number of *distinct*
    farmers who reported in that cell, not raw report rows (so one farmer
    submitting several photos can't inflate a hotspot on their own).
    """

    diagnosis_type: str
    label: str
    severity: str | None
    report_count: int
    latitude: float
    longitude: float
    distance_km: float
    last_reported_at: datetime


class OutbreakMapOut(BaseModel):
    center_latitude: float
    center_longitude: float
    radius_km: float
    generated_at: datetime
    hotspots: list[OutbreakHotspot]