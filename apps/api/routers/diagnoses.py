import base64
import binascii
import logging
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from apps.api.core.deps import get_current_user
from apps.api.core.rate_limit import rate_limit
from apps.api.core.config import settings
from apps.api.db.session import get_db
from apps.api.models.diagnosis import Diagnosis
from apps.api.models.farm import Field
from apps.api.models.user import User
from apps.api.schemas.diagnosis import DiagnosisHistoryItem, DiagnosisOut
from apps.api.services import context_service, storage_service, weather_service
from apps.api.services.inference_client import needs_expert_review, retry_guidance_for, run_inference
from apps.api.services.surveillance_service import check_and_raise_outbreak_alert

logger = logging.getLogger("agrisense.diagnoses")
router = APIRouter(tags=["diagnoses"])
DiagnosisType = Literal["plant_id", "disease", "pest"]


async def _run_diagnosis(
    diagnosis_type: DiagnosisType,
    file: UploadFile,
    field_id: str | None,
    latitude: float | None,
    longitude: float | None,
    progress_group_id: str | None,
    db: Session,
    user: User,
) -> Diagnosis:
    contents = await storage_service.validate_image(file)

    # A diagnosis may only be attached to a field the user owns.
    if field_id:
        owned = db.query(Field).filter(Field.id == field_id, Field.farm.has(user_id=user.id)).first()
        if owned is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    content_type = storage_service.detect_content_type(contents)  # from the real bytes, not the header
    image_url = storage_service.upload_diagnosis_image(contents, content_type, user.id)

    try:
        result = await run_inference(diagnosis_type, image_url)
    except Exception:
        # Analysis failed: remove the saved photo so failed attempts leave nothing behind.
        storage_service.delete_stored_image(image_url)
        raise
    # Defense-in-depth: whatever the inference service returns, never let a
    # malformed/unnormalized model output (e.g. a raw logit or pixel
    # coordinate mistaken for a confidence score) reach the database — the
    # confidence_score column is a tight NUMERIC(5,4) and an out-of-range
    # value throws a DataError that fails the whole request.
    confidence = max(0.0, min(1.0, float(result["confidence"])))

    # Optional explanation overlay: validate it really is a PNG before storing it.
    heatmap_url = None
    heatmap_b64 = result.get("heatmap_png_b64")
    if heatmap_b64:
        try:
            png = base64.b64decode(heatmap_b64, validate=True)
            if len(png) <= storage_service.MAX_FILE_SIZE_BYTES and storage_service.detect_content_type(png) == "image/png":
                heatmap_url = storage_service.upload_heatmap_image(png, user.id)
        except (binascii.Error, ValueError, HTTPException):
            logger.warning("Ignoring an invalid heatmap from the inference service")

    diagnosis = Diagnosis(
        user_id=user.id,
        field_id=field_id,
        diagnosis_type=diagnosis_type,
        result_id=result.get("result_id"),
        result_label=result["label"],
        image_url=image_url,
        heatmap_url=heatmap_url,
        confidence_score=confidence,
        severity=result.get("severity"),
        model_version=result["model_version"],
        needs_expert_review=needs_expert_review(confidence),
        progress_group_id=progress_group_id or (str(uuid.uuid4()) if field_id else None),
        latitude=latitude,
        longitude=longitude,
    )
    db.add(diagnosis)
    db.commit()
    db.refresh(diagnosis)

    if diagnosis_type in ("disease", "pest"):
        check_and_raise_outbreak_alert(db, diagnosis)

    # Weather advisory: if this diagnosis is linked to a field (and that
    # field's farm has coordinates), fold current weather-derived risk
    # into the response so the farmer gets proactive advice, not just a label.
    weather_advisory = None
    if field_id:
        field = db.query(Field).filter(Field.id == field_id, Field.farm.has(user_id=user.id)).first()
        if field is not None and field.farm is not None:
            try:
                weather = await weather_service.get_weather_for_farm(db, field.farm)
                weather_advisory = context_service.build_weather_advisory(weather)
            except Exception:
                weather_advisory = None

    out = DiagnosisOut.model_validate(diagnosis)
    out.causes = result.get("causes")
    out.organic_treatment = result.get("organic_treatment")
    out.chemical_treatment = result.get("chemical_treatment")
    out.prevention_tips = result.get("prevention_tips")
    out.retry_guidance = retry_guidance_for(diagnosis_type, confidence)
    out.weather_advisory = weather_advisory
    return out


@router.post("/identify-plant", response_model=DiagnosisOut, dependencies=[Depends(rate_limit(settings.INFERENCE_RATE_LIMIT_PER_MINUTE))])
async def identify_plant(
    file: UploadFile = File(...),
    field_id: str | None = Form(None),
    latitude: float | None = Form(None, ge=-90, le=90),
    longitude: float | None = Form(None, ge=-180, le=180),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _run_diagnosis("plant_id", file, field_id, latitude, longitude, None, db, user)


@router.post("/detect-disease", response_model=DiagnosisOut, dependencies=[Depends(rate_limit(settings.INFERENCE_RATE_LIMIT_PER_MINUTE))])
async def detect_disease(
    file: UploadFile = File(...),
    field_id: str | None = Form(None),
    latitude: float | None = Form(None, ge=-90, le=90),
    longitude: float | None = Form(None, ge=-180, le=180),
    progress_group_id: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _run_diagnosis("disease", file, field_id, latitude, longitude, progress_group_id, db, user)


@router.post("/detect-pest", response_model=DiagnosisOut, dependencies=[Depends(rate_limit(settings.INFERENCE_RATE_LIMIT_PER_MINUTE))])
async def detect_pest(
    file: UploadFile = File(...),
    field_id: str | None = Form(None),
    latitude: float | None = Form(None, ge=-90, le=90),
    longitude: float | None = Form(None, ge=-180, le=180),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _run_diagnosis("pest", file, field_id, latitude, longitude, None, db, user)


@router.get("/history", response_model=list[DiagnosisHistoryItem])
def get_history(
    type: DiagnosisType | None = None,
    field_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Diagnosis).filter(Diagnosis.user_id == user.id)
    if type:
        query = query.filter(Diagnosis.diagnosis_type == type)
    if field_id:
        query = query.filter(Diagnosis.field_id == field_id)
    return query.order_by(Diagnosis.created_at.desc()).all()


@router.get("/history/progress/{progress_group_id}", response_model=list[DiagnosisHistoryItem])
def get_progress_series(progress_group_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Diagnosis)
        .filter(Diagnosis.progress_group_id == progress_group_id, Diagnosis.user_id == user.id)
        .order_by(Diagnosis.created_at.asc())
        .all()
    )