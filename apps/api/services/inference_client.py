import logging
from typing import Literal, TypedDict

import httpx
from fastapi import HTTPException, status

from apps.api.core.config import settings

logger = logging.getLogger("agrisense.inference")

DiagnosisType = Literal["plant_id", "disease", "pest"]
CONFIDENCE_THRESHOLD = 0.70


class InferenceResult(TypedDict):
    label: str
    result_id: str | None
    confidence: float
    severity: str | None
    heatmap_url: str | None
    heatmap_png_b64: str | None
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
    if settings.INTERNAL_API_URL and image_url.startswith(settings.API_PUBLIC_URL):
        internal_image_url = settings.INTERNAL_API_URL + image_url[len(settings.API_PUBLIC_URL):]

    headers = {"X-Inference-Key": settings.INFERENCE_API_KEY} if settings.INFERENCE_API_KEY else {}
    unavailable = HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="The analysis service is temporarily unavailable. Please try again in a moment.",
    )
    try:
        async with httpx.AsyncClient(base_url=settings.INFERENCE_SERVICE_URL, timeout=30.0) as client:
            response = await client.post(endpoint_map[diagnosis_type], json={"image_url": internal_image_url}, headers=headers)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 413, 415, 422):
            # The service understood the request but could not use the image.
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="We could not read this image. Please try a clearer JPEG, PNG or WebP photo.",
            ) from exc
        logger.error("Inference service returned %s for %s", exc.response.status_code, diagnosis_type)
        raise unavailable from exc
    except (httpx.RequestError, ValueError) as exc:  # connection refused, timeout, bad JSON
        logger.error("Inference service unreachable or invalid response for %s: %s", diagnosis_type, type(exc).__name__)
        raise unavailable from exc

    # Check the response really has the shape we rely on before it goes anywhere near the database.
    if (
        not isinstance(data, dict)
        or not isinstance(data.get("label"), str)
        or isinstance(data.get("confidence"), bool)
        or not isinstance(data.get("confidence"), (int, float))
        or not isinstance(data.get("model_version"), str)
    ):
        logger.error("Inference service returned an unexpected response shape for %s", diagnosis_type)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The analysis service returned an invalid result.")

    # A "-stub" model version means real weights were not loaded. Never present that as a real result.
    if data["model_version"].endswith("-stub"):
        logger.error("Inference service is running a stub for %s (model weights not loaded)", diagnosis_type)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="This analysis is not available yet. Please try again later.",
        )
    return data  # type: ignore[return-value]


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