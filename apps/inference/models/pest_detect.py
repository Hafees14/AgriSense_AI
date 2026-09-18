import re
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


def _normalize(label: str) -> str:
    """Same idea as the disease lookup: IP102-style label files often use
    underscored or differently-cased names (e.g. "rice_leaf_roller" or
    "Tomato_Fruitworm") rather than a clean display string. Strip
    separators and lowercase so PEST_INFO_LOOKUP matches regardless.
    """
    cleaned = re.sub(r"[_\-]+", " ", label)
    return cleaned.strip().lower()


# Keyed by normalized pest name. Covers common IP102 classes and pests
# most relevant to Sri Lankan smallholder crops (rice, vegetables). As
# with disease: an unlisted class still returns label + confidence, just
# with blank advice fields — add an entry here for anything you see
# coming back empty.
PEST_INFO_LOOKUP: dict[str, dict] = {
    "tomato fruitworm": {
        "severity": "high",
        "causes": "Larval stage of Helicoverpa armigera feeding on fruit.",
        "organic_treatment": "Bacillus thuringiensis (Bt) spray; hand removal of larvae.",
        "chemical_treatment": "Approved pyrethroid-based insecticide per label instructions.",
        "prevention_tips": "Pheromone traps, regular scouting, avoid dense planting.",
    },
    "aphid": {
        "severity": "moderate",
        "causes": "Sap-sucking insects that cluster on new growth and undersides of leaves.",
        "organic_treatment": "Insecticidal soap, neem oil, or introduce ladybird beetles.",
        "chemical_treatment": "Imidacloprid or other systemic aphicide per label instructions.",
        "prevention_tips": "Reflective mulch, remove weeds that host aphids, monitor new growth weekly.",
    },
    "aphids": {
        "severity": "moderate",
        "causes": "Sap-sucking insects that cluster on new growth and undersides of leaves.",
        "organic_treatment": "Insecticidal soap, neem oil, or introduce ladybird beetles.",
        "chemical_treatment": "Imidacloprid or other systemic aphicide per label instructions.",
        "prevention_tips": "Reflective mulch, remove weeds that host aphids, monitor new growth weekly.",
    },
    "whitefly": {
        "severity": "high",
        "causes": "Small sap-sucking insects that also transmit viral diseases (e.g. yellow leaf curl virus).",
        "organic_treatment": "Yellow sticky traps, insecticidal soap, neem oil.",
        "chemical_treatment": "Imidacloprid or pyriproxyfen-based insecticide per label instructions.",
        "prevention_tips": "Whitefly-proof nursery screens, reflective mulch, remove heavily infested leaves early.",
    },
    "mealybug": {
        "severity": "moderate",
        "causes": "Sap-sucking insects covered in white waxy coating, often found in leaf axils.",
        "organic_treatment": "Wipe with alcohol-soaked cloth for small infestations; insecticidal soap or neem oil.",
        "chemical_treatment": "Systemic insecticide (e.g. imidacloprid) per label instructions.",
        "prevention_tips": "Inspect new plants before introducing them, avoid over-fertilizing with nitrogen.",
    },
    "thrips": {
        "severity": "moderate",
        "causes": "Tiny slender insects that rasp plant surfaces and feed on sap, causing silvering/scarring.",
        "organic_treatment": "Blue sticky traps, insecticidal soap, predatory mites.",
        "chemical_treatment": "Spinosad-based insecticide per label instructions.",
        "prevention_tips": "Remove weeds and plant debris, avoid excess nitrogen, monitor with sticky traps.",
    },
    "armyworm": {
        "severity": "critical",
        "causes": "Larvae of Spodoptera species that feed voraciously, often at night, moving in groups.",
        "organic_treatment": "Bacillus thuringiensis (Bt) spray; hand-picking in early infestations.",
        "chemical_treatment": "Chlorantraniliprole or spinetoram-based insecticide per label instructions.",
        "prevention_tips": "Early detection via pheromone traps, field sanitation, timely planting.",
    },
    "fall armyworm": {
        "severity": "critical",
        "causes": "Spodoptera frugiperda larvae feeding on leaf whorls, especially in maize.",
        "organic_treatment": "Bacillus thuringiensis (Bt) spray; hand-picking egg masses and larvae.",
        "chemical_treatment": "Chlorantraniliprole or emamectin benzoate-based insecticide per label instructions.",
        "prevention_tips": "Early planting, field scouting from emergence, intercropping with repellent plants.",
    },
    "cutworm": {
        "severity": "moderate",
        "causes": "Nocturnal moth larvae that cut young seedlings at the soil line.",
        "organic_treatment": "Collar barriers around seedlings; hand-picking at night with a flashlight.",
        "chemical_treatment": "Soil-applied insecticide (e.g. chlorpyrifos alternative per local regulation) around seedling base.",
        "prevention_tips": "Till soil before planting to expose larvae, remove weeds, delay planting after heavy infestation.",
    },
    "diamondback moth": {
        "severity": "high",
        "causes": "Plutella xylostella larvae feeding on brassica leaves, notorious for insecticide resistance.",
        "organic_treatment": "Bacillus thuringiensis (Bt) spray; pheromone traps for monitoring.",
        "chemical_treatment": "Rotate insecticide classes (e.g. spinetoram, chlorantraniliprole) to manage resistance.",
        "prevention_tips": "Crop rotation away from brassicas, trap crops, remove crop residue after harvest.",
    },
    "leaf miner": {
        "severity": "moderate",
        "causes": "Larvae that tunnel between leaf surfaces, leaving winding pale trails.",
        "organic_treatment": "Remove and destroy affected leaves; neem oil spray.",
        "chemical_treatment": "Abamectin or spinosad-based insecticide per label instructions.",
        "prevention_tips": "Yellow sticky traps, remove volunteer host plants, monitor early in the season.",
    },
    "spider mite": {
        "severity": "moderate",
        "causes": "Tiny arachnids that thrive in hot, dry conditions, causing stippled/bronzed leaves.",
        "organic_treatment": "Insecticidal soap or neem oil; increase humidity; introduce predatory mites.",
        "chemical_treatment": "Miticide labeled for spider mites, rotate active ingredients.",
        "prevention_tips": "Avoid drought stress, hose down leaves periodically, monitor in hot weather.",
    },
    "brown planthopper": {
        "severity": "critical",
        "causes": "Nilaparvata lugens, a major rice pest that also transmits viral diseases and causes 'hopperburn'.",
        "organic_treatment": "Encourage natural predators (spiders, mirid bugs); avoid excess nitrogen fertilization.",
        "chemical_treatment": "Systemic insecticide (e.g. buprofezin) per label instructions and local resistance advisories.",
        "prevention_tips": "Use resistant rice varieties, avoid continuous rice cropping, synchronize planting with neighbors.",
    },
    "rice leaf roller": {
        "severity": "moderate",
        "causes": "Larvae that roll and feed within rice leaves, reducing photosynthetic area.",
        "organic_treatment": "Bacillus thuringiensis (Bt) spray; conserve natural enemies like parasitic wasps.",
        "chemical_treatment": "Chlorantraniliprole-based insecticide per label instructions.",
        "prevention_tips": "Balanced nitrogen use, field monitoring during vegetative stage, synchronized planting.",
    },
    "stem borer": {
        "severity": "high",
        "causes": "Larvae that bore into plant stems, causing 'deadheart' in vegetative stage or 'whitehead' at heading.",
        "organic_treatment": "Remove and destroy affected tillers; release Trichogramma parasitic wasps.",
        "chemical_treatment": "Granular systemic insecticide applied at recommended growth stage.",
        "prevention_tips": "Synchronized planting, resistant varieties, remove stubble after harvest.",
    },
    "fruit fly": {
        "severity": "high",
        "causes": "Adult flies lay eggs in ripening fruit; larvae feed inside, causing fruit drop and rot.",
        "organic_treatment": "Methyl eugenol or protein bait traps; bag fruit; collect and destroy fallen fruit.",
        "chemical_treatment": "Bait spray with approved insecticide (e.g. spinosad-based bait) per label instructions.",
        "prevention_tips": "Field sanitation (remove fallen fruit), mass trapping, harvest fruit promptly at maturity.",
    },
    "mite": {
        "severity": "moderate",
        "causes": "Various mite species feeding on leaf sap, thriving in hot, dry conditions.",
        "organic_treatment": "Insecticidal soap or neem oil; increase humidity; predatory mites.",
        "chemical_treatment": "Miticide labeled for the specific mite species per label instructions.",
        "prevention_tips": "Avoid drought stress, monitor regularly in dry weather.",
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
            info = PEST_INFO_LOOKUP["tomato fruitworm"]
            return DetectionResponse(label="Tomato Fruitworm", confidence=0.0, model_version=f"{MODEL_VERSION}-stub", **info)

        input_name = self._session.get_inputs()[0].name
        raw_output = self._session.run(None, {input_name: tensor})[0]
        label, confidence = _best_detection(raw_output, self._labels, CONF_THRESHOLD)
        info = get_pest_info(label)

        return DetectionResponse(label=label, confidence=confidence, model_version=MODEL_VERSION, **info)


def get_pest_info(label: str) -> dict:
    """Look up treatment info, trying the exact label first (in case
    labels.json already stores clean names), then a normalized match.
    Returns {} if nothing matches, so callers can safely .get() further.
    """
    if label in PEST_INFO_LOOKUP:
        return PEST_INFO_LOOKUP[label]
    return PEST_INFO_LOOKUP.get(_normalize(label), {})


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

    if detections.shape[0] < detections.shape[1] and detections.shape[0] in (
        4 + num_classes,
        5 + num_classes,
    ):
        detections = detections.T

    num_attrs = detections.shape[1]

    if num_attrs == 5 + num_classes:
        obj_scores = detections[:, 4]
        class_scores = detections[:, 5:]
    elif num_attrs == 4 + num_classes:
        obj_scores = np.ones(detections.shape[0], dtype=np.float32)
        class_scores = detections[:, 4:]
    else:
        return "Unknown", 0.0

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