from pydantic import BaseModel, Field


class DetectionRequest(BaseModel):
    image_url: str


class Detection(BaseModel):
    label: str
    confidence: float
    # [x1, y1, x2, y2] in pixels of the original image
    box: list[float]


class DetectionResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    label: str
    result_id: str | None = None
    confidence: float
    severity: str | None = None
    heatmap_url: str | None = None
    # Base64 PNG of the explanation overlay. The core API saves it and turns it into heatmap_url.
    heatmap_png_b64: str | None = None
    model_version: str
    causes: str | None = None
    organic_treatment: str | None = None
    chemical_treatment: str | None = None
    prevention_tips: str | None = None
    # Pest detection only: every box found after non-max suppression. Optional, so older clients still work.
    detections: list[Detection] | None = None
    detection_count: int | None = None
