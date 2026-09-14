from pathlib import Path

import numpy as np
import onnxruntime as ort

from apps.inference.preprocessing.image_pipeline import download_image, preprocess_for_detection
from apps.inference.schemas import DetectionResponse
from apps.inference.utils.labels import load_labels

MODEL_VERSION = "pest-detect-yolov11n-v1"
WEIGHTS_PATH = Path(__file__).resolve().parents[1] / "weights" / "pest_detect.onnx"
LABELS_PATH = Path(__file__).resolve().parents[1] / "weights" / "pest_labels.json"
CONF_THRESHOLD = 0.25

# Fill in one entry per pest class in pest_labels.json — anything not listed
# here comes back with a correct label + confidence but blank treatment
# fields, since PEST_INFO_LOOKUP.get(label, {}) silently returns nothing
# for unknown keys.
PEST_INFO_LOOKUP = {
    "Tomato Fruitworm": {
        "severity": "high",
        "causes": "Larval stage of Helicoverpa armigera feeding on fruit.",
        "organic_treatment": "Bacillus thuringiensis (Bt) spray; hand removal of larvae.",
        "chemical_treatment": "Approved pyrethroid-based insecticide per label instructions.",
        "prevention_tips": "Pheromone traps, regular scouting, avoid dense planting.",
    },
}


class PestDetector:
    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None
        self._labels: list[str] = []
        if WEIGHTS_PATH.exists() and LABELS_PATH.exists():
            self._session = ort.InferenceSession(str(WEIGHTS_PATH), providers=["CPUExecutionProvider"])
            self._labels = load_labels(LABELS_PATH)

    async def predict(self, image_url: str) -> DetectionResponse:
        image = await download_image(image_url)
        tensor = preprocess_for_detection(image)

        if self._session is None:
            info = PEST_INFO_LOOKUP["Tomato Fruitworm"]
            return DetectionResponse(label="Tomato Fruitworm", confidence=0.0, model_version=f"{MODEL_VERSION}-stub", **info)

        input_name = self._session.get_inputs()[0].name
        raw_output = self._session.run(None, {input_name: tensor})[0]
        label, confidence = _best_detection(raw_output, self._labels, CONF_THRESHOLD)
        info = PEST_INFO_LOOKUP.get(label, {})

        return DetectionResponse(label=label, confidence=confidence, model_version=MODEL_VERSION, **info)


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _best_detection(raw_output: np.ndarray, labels: list[str], conf_threshold: float) -> tuple[str, float]:
    """Parse a YOLO-style detection tensor into (label, confidence in [0, 1]).

    Different YOLO export configs produce different layouts, and getting
    this wrong doesn't raise an exception — it just produces a garbage
    number (e.g. a raw pixel coordinate) that silently gets treated as a
    confidence score. This handles the layouts that actually vary in
    practice:

      1. Orientation: ultralytics' ONNX export commonly emits
         (1, 4 + num_classes[, + 1], num_boxes) — i.e. transposed relative
         to the (1, num_boxes, attrs) layout older code / YOLOv5 assumed.
         We detect and fix this by comparing the two dimensions: the
         "attributes" axis is always much smaller than the "boxes" axis.
      2. Objectness column: YOLOv5-style output has a separate objectness
         score at index 4 before the per-class scores; many YOLOv8/v11
         exports drop it entirely (attrs = 4 + num_classes, not
         5 + num_classes). We pick whichever layout matches the actual
         attribute count for this model/labels file.
      3. Activation: some exports return raw logits instead of
         already-sigmoided probabilities. If values fall outside a
         plausible probability range, we apply sigmoid before using them.

    Whatever the input looks like, the returned confidence is always
    clamped to [0, 1] so a parsing mismatch can never reach the database
    as an out-of-range value again.
    """
    detections = np.asarray(raw_output)
    if detections.ndim == 3:
        detections = detections[0]

    if detections.size == 0:
        return "Unknown", 0.0

    num_classes = len(labels)

    # Normalize orientation to (num_boxes, num_attributes). The attribute
    # count (4 box coords + objectness? + classes) is always far smaller
    # than the number of candidate boxes (hundreds to thousands), so the
    # smaller dimension is the attributes axis.
    if detections.shape[0] < detections.shape[1] and detections.shape[0] in (
        4 + num_classes,
        5 + num_classes,
    ):
        detections = detections.T

    num_attrs = detections.shape[1]

    if num_attrs == 5 + num_classes:
        # YOLOv5-style: [cx, cy, w, h, objectness, class_0..class_n]
        obj_scores = detections[:, 4]
        class_scores = detections[:, 5:]
    elif num_attrs == 4 + num_classes:
        # YOLOv8/v11-style: no separate objectness column.
        obj_scores = np.ones(detections.shape[0], dtype=np.float32)
        class_scores = detections[:, 4:]
    else:
        # Attribute count doesn't match either expected layout for this
        # labels file (e.g. labels file out of sync with the exported
        # model) — fail safe instead of indexing into the wrong columns.
        return "Unknown", 0.0

    # If values look like raw logits (outside a plausible probability
    # range) rather than already-activated probabilities, apply sigmoid.
    if obj_scores.max(initial=0.0) > 1.5 or obj_scores.min(initial=0.0) < -0.5:
        obj_scores = _sigmoid(obj_scores)
    if class_scores.max(initial=0.0) > 1.5 or class_scores.min(initial=0.0) < -0.5:
        class_scores = _sigmoid(class_scores)

    combined_scores = obj_scores * class_scores.max(axis=1)
    best_idx = int(np.argmax(combined_scores))
    best_score = float(np.clip(combined_scores[best_idx], 0.0, 1.0))

    if best_score < conf_threshold:
        return "Unknown", best_score

    class_idx = int(np.argmax(class_scores[best_idx]))
    label = labels[class_idx] if class_idx < len(labels) else "Unknown"
    return label, best_score