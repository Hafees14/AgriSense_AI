from fastapi import Depends, FastAPI

from apps.inference.models.disease_detect import DiseaseDetector
from apps.inference.models.pest_detect import PestDetector
from apps.inference.models.plant_id import PlantIdentifier
from apps.inference.schemas import DetectionRequest, DetectionResponse
from apps.inference.security import require_inference_key

app = FastAPI(title="AgriSense AI — Inference Service", version="0.1.0")

plant_identifier = PlantIdentifier()
disease_detector = DiseaseDetector()
pest_detector = PestDetector()

_guard = [Depends(require_inference_key)]


@app.get("/health")
def health():
    """Reports which models are really loaded. 'ok' means every model is ready."""
    models = {
        "disease": {"loaded": disease_detector._session is not None, "reason": disease_detector.stub_reason},
        "pest": {"loaded": pest_detector._session is not None, "reason": pest_detector.stub_reason},
        "plant_id": {"loaded": plant_identifier._session is not None, "reason": plant_identifier.stub_reason},
    }
    core_ready = models["disease"]["loaded"] and models["pest"]["loaded"]
    return {"status": "ok" if core_ready else "degraded", "models": models}


@app.post("/identify-plant", response_model=DetectionResponse, dependencies=_guard)
async def identify_plant(payload: DetectionRequest):
    return await plant_identifier.predict(payload.image_url)


@app.post("/detect-disease", response_model=DetectionResponse, dependencies=_guard)
async def detect_disease(payload: DetectionRequest):
    return await disease_detector.predict(payload.image_url)


@app.post("/detect-pest", response_model=DetectionResponse, dependencies=_guard)
async def detect_pest(payload: DetectionRequest):
    return await pest_detector.predict(payload.image_url)
