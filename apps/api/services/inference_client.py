from typing import Literal, TypedDict

import httpx

from apps.api.core.config import settings

DiagnosisType = Literal["plant_id", "disease", "pest"]
CONFIDENCE_THRESHOLD = 0.70


class InferenceResult(TypedDict):
    label: str
    result_id: str | None
    confidence: float
    severity: str | None
    heatmap_url: str | None
    model_version: str
    causes: str | None
    organic_treatment: str | None
    chemical_treatment: str | None
    prevention_tips: str | None


async def run_inference(diagnosis_type: DiagnosisType, image_url: str) -> InferenceResult:
    endpoint_map = {"plant_id": "/identify-plant", "disease": "/detect-disease", "pest": "/detect-pest"}

    # image_url is built with API_PUBLIC_URL (e.g. http://localhost:8000/uploads/...)
    # so the browser can load it. The inference container can't reach "localhost"
    # (that's itself), so swap in the internal Docker network address before
    # asking the inference service to fetch this image.
    internal_image_url = image_url
    if image_url.startswith(settings.API_PUBLIC_URL):
        internal_image_url = settings.INTERNAL_API_URL + image_url[len(settings.API_PUBLIC_URL):]

    async with httpx.AsyncClient(base_url=settings.INFERENCE_SERVICE_URL, timeout=30.0) as client:
        response = await client.post(endpoint_map[diagnosis_type], json={"image_url": internal_image_url})
        response.raise_for_status()
        return response.json()


def needs_expert_review(confidence: float) -> bool:
    return confidence < CONFIDENCE_THRESHOLD


def retry_guidance_for(diagnosis_type: DiagnosisType, confidence: float) -> str | None:
    if confidence >= CONFIDENCE_THRESHOLD:
        return None
    if diagnosis_type == "disease":
        return (
            "Confidence is low for this image. Please upload another photo showing the "
            "underside of the leaf in good lighting, or a closer shot of the affected area."
        )
    if diagnosis_type == "pest":
        return "Confidence is low. Please upload a closer, well-lit photo of the insect or larvae."
    return "Confidence is low. Please upload a clearer photo of the whole plant."