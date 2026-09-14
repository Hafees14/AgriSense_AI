from pathlib import Path

import numpy as np
import onnxruntime as ort

from apps.inference.preprocessing.image_pipeline import download_image, preprocess_for_classification
from apps.inference.schemas import DetectionResponse
from apps.inference.utils.labels import load_labels

MODEL_VERSION = "plant-id-efficientnet-b3-v1"
WEIGHTS_PATH = Path(__file__).resolve().parents[1] / "weights" / "plant_id.onnx"
LABELS_PATH = Path(__file__).resolve().parents[1] / "weights" / "plant_id_labels.json"


class PlantIdentifier:
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
            return DetectionResponse(label="Tomato (Solanum lycopersicum)", confidence=0.0, model_version=f"{MODEL_VERSION}-stub")

        input_name = self._session.get_inputs()[0].name
        logits = self._session.run(None, {input_name: tensor})[0][0]
        probs = _softmax(logits)
        top_idx = int(np.argmax(probs))

        if top_idx >= len(self._labels):
            return DetectionResponse(label="Unrecognized", confidence=float(probs[top_idx]), model_version=MODEL_VERSION)

        return DetectionResponse(label=self._labels[top_idx], confidence=float(probs[top_idx]), model_version=MODEL_VERSION)


def _softmax(x: np.ndarray) -> np.ndarray:
    exp = np.exp(x - np.max(x))
    return exp / exp.sum()