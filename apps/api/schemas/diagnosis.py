from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class DiagnosisRequestMeta(BaseModel):
    field_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class DiagnosisOut(BaseModel):
    model_config = {"from_attributes": True, "protected_namespaces": ()}

    id: str
    diagnosis_type: Literal["plant_id", "disease", "pest"]
    result_label: str
    confidence_score: float
    severity: str | None
    image_url: str
    heatmap_url: str | None
    needs_expert_review: bool
    model_version: str
    created_at: datetime

    causes: str | None = None
    organic_treatment: str | None = None
    chemical_treatment: str | None = None
    prevention_tips: str | None = None
    retry_guidance: str | None = None
    weather_advisory: str | None = None


class DiagnosisHistoryItem(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    diagnosis_type: str
    result_label: str
    confidence_score: float
    severity: str | None
    image_url: str
    progress_group_id: str | None
    created_at: datetime