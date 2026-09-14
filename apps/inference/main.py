from fastapi import FastAPI

from apps.inference.models.disease_detect import DiseaseDetector
from apps.inference.models.pest_detect import PestDetector
from apps.inference.models.plant_id import PlantIdentifier
from apps.inference.schemas import DetectionRequest, DetectionResponse

app = FastAPI(title="AgriSense AI — Inference Service", version="0.1.0")

plant_identifier = PlantIdentifier()
disease_detector = DiseaseDetector()
pest_detector = PestDetector()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/identify-plant", response_model=DetectionResponse)
async def identify_plant(payload: DetectionRequest):
    return await plant_identifier.predict(payload.image_url)


@app.post("/detect-disease", response_model=DetectionResponse)
async def detect_disease(payload: DetectionRequest):
    return await disease_detector.predict(payload.image_url)


@app.post("/detect-pest", response_model=DetectionResponse)
async def detect_pest(payload: DetectionRequest):
    return await pest_detector.predict(payload.image_url)
