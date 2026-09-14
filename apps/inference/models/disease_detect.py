from pathlib import Path

import numpy as np
import onnxruntime as ort

from apps.inference.preprocessing.image_pipeline import download_image, preprocess_for_classification
from apps.inference.schemas import DetectionResponse
from apps.inference.utils.labels import load_labels

MODEL_VERSION = "disease-detect-efficientnet-b4-v1"
WEIGHTS_PATH = Path(__file__).resolve().parents[1] / "weights" / "disease_detect.onnx"
LABELS_PATH = Path(__file__).resolve().parents[1] / "weights" / "disease_labels.json"

TREATMENT_LOOKUP = {
    "Early Blight": {
        "severity": "moderate",
        "causes": "Fungal pathogen Alternaria solani, favored by warm, humid conditions.",
        "organic_treatment": "Remove affected leaves; apply copper-based fungicide or neem oil.",
        "chemical_treatment": "Chlorothalonil or mancozeb-based fungicide per label instructions.",
        "prevention_tips": "Crop rotation, adequate spacing, avoid overhead watering.",
    },
}


class DiseaseDetector:
    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None
        self._labels: list[str] = []
        if WEIGHTS_PATH.exists() and LABELS_PATH.exists():
            self._session = ort.InferenceSession(str(WEIGHTS_PATH), providers=["CPUExecutionProvider"])
            self._labels = load_labels(LABELS_PATH)

    async def predict(self, image_url: str) -> DetectionResponse:
        image = await download_image(image_url)
        tensor = preprocess_for_classification(image)

        if self._session is None:
            info = TREATMENT_LOOKUP["Early Blight"]
            return DetectionResponse(label="Early Blight", confidence=0.0, model_version=f"{MODEL_VERSION}-stub", **info)

        input_name = self._session.get_inputs()[0].name
        logits = self._session.run(None, {input_name: tensor})[0][0]
        probs = _softmax(logits)
        top_idx = int(np.argmax(probs))

        if top_idx >= len(self._labels):
            # Model output has more classes than the labels file lists —
            # fail safe instead of crashing the request.
            return DetectionResponse(
                label="Unrecognized",
                confidence=float(probs[top_idx]),
                model_version=MODEL_VERSION,
            )

        label = self._labels[top_idx]
        confidence = float(probs[top_idx])

        heatmap_url = self._generate_heatmap(image_url, tensor) if confidence >= 0.5 else None
        info = TREATMENT_LOOKUP.get(label, {})

        return DetectionResponse(label=label, confidence=confidence, model_version=MODEL_VERSION, heatmap_url=heatmap_url, **info)

    def _generate_heatmap(self, image_url: str, tensor: np.ndarray) -> str | None:
        return None


def _softmax(x: np.ndarray) -> np.ndarray:
    exp = np.exp(x - np.max(x))
    return exp / exp.sum()