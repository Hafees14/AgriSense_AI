from pydantic import BaseModel


class DetectionRequest(BaseModel):
    image_url: str


class DetectionResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    label: str
    result_id: str | None = None
    confidence: float
    severity: str | None = None
    heatmap_url: str | None = None
    model_version: str
    causes: str | None = None
    organic_treatment: str | None = None
    chemical_treatment: str | None = None
    prevention_tips: str | None = None
