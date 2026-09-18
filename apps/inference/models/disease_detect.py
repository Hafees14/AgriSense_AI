import re
from pathlib import Path

import numpy as np
import onnxruntime as ort

from apps.inference.preprocessing.image_pipeline import download_image, preprocess_for_classification
from apps.inference.schemas import DetectionResponse
from apps.inference.utils.labels import load_labels

MODEL_VERSION = "disease-detect-efficientnet-b4-v1"
WEIGHTS_PATH = Path(__file__).resolve().parents[1] / "weights" / "disease_detect.onnx"
LABELS_PATH = Path(__file__).resolve().parents[1] / "weights" / "disease_labels.json"


def _normalize(label: str) -> str:
    """Dataset label files rarely match a human-readable string exactly —
    PlantVillage-style exports commonly look like "Tomato___Early_blight"
    or "Tomato_healthy" rather than "Early Blight". This strips the crop
    prefix (before "___" or the first underscore-separated segment when it
    looks like a crop name), replaces separators with spaces, and
    lowercases, so TREATMENT_LOOKUP matches regardless of the exact
    formatting your labels.json happens to use.
    """
    cleaned = label.replace("___", "_")
    parts = [p for p in re.split(r"[_\-]+", cleaned) if p]
    # Drop a leading crop-name token (e.g. "Tomato", "Potato", "Apple",
    # "Corn", "Grape", "Pepper") if present, since treatments below are
    # keyed by disease name only.
    known_crops = {
        "tomato", "potato", "apple", "corn", "maize", "grape", "pepper",
        "bell", "strawberry", "peach", "cherry", "squash", "soybean",
        "orange", "blueberry", "raspberry",
    }
    if parts and parts[0].lower() in known_crops:
        parts = parts[1:]
    return " ".join(parts).strip().lower()


# Keyed by normalized disease name (crop prefix stripped, lowercased,
# underscores→spaces) so this matches regardless of exact labels.json
# formatting. Covers the standard PlantVillage/PlantDoc disease classes.
# IMPORTANT: if your model predicts a disease not listed here, it will
# still return a correct label + confidence, but these four advice fields
# will be blank — add an entry here (or ask for one) for anything you see
# coming back empty in practice.
TREATMENT_LOOKUP: dict[str, dict] = {
    "healthy": {
        "severity": "low",
        "causes": "No disease detected.",
        "organic_treatment": "No treatment needed. Continue routine monitoring.",
        "chemical_treatment": "Not applicable.",
        "prevention_tips": "Maintain good field hygiene, balanced fertilization, and regular scouting.",
    },
    "early blight": {
        "severity": "moderate",
        "causes": "Fungal pathogen Alternaria solani, favored by warm, humid conditions.",
        "organic_treatment": "Remove affected leaves; apply copper-based fungicide or neem oil.",
        "chemical_treatment": "Chlorothalonil or mancozeb-based fungicide per label instructions.",
        "prevention_tips": "Crop rotation, adequate spacing, avoid overhead watering.",
    },
    "late blight": {
        "severity": "critical",
        "causes": "Oomycete pathogen Phytophthora infestans; spreads rapidly in cool, wet weather.",
        "organic_treatment": "Remove and destroy infected plants immediately; copper-based fungicide as a preventive.",
        "chemical_treatment": "Chlorothalonil, mancozeb, or metalaxyl-based fungicide; rotate active ingredients to avoid resistance.",
        "prevention_tips": "Avoid overhead irrigation, ensure good airflow, use certified disease-free seed/seedlings, destroy volunteer plants.",
    },
    "bacterial spot": {
        "severity": "moderate",
        "causes": "Xanthomonas bacteria, spread by splashing water and contaminated tools.",
        "organic_treatment": "Copper-based bactericide; remove and destroy infected plant debris.",
        "chemical_treatment": "Copper hydroxide combined with mancozeb per label instructions.",
        "prevention_tips": "Use disease-free seed, avoid working in wet fields, disinfect tools between plants.",
    },
    "bacterial wilt": {
        "severity": "critical",
        "causes": "Ralstonia solanacearum bacteria, persists in soil and spreads via irrigation water and tools.",
        "organic_treatment": "Remove and destroy infected plants; solarize soil before replanting.",
        "chemical_treatment": "No effective chemical cure; focus on sanitation and resistant varieties.",
        "prevention_tips": "Crop rotation with non-host crops, resistant varieties, avoid fields with a history of the disease.",
    },
    "leaf mold": {
        "severity": "moderate",
        "causes": "Fungal pathogen Passalora fulva, thrives in high humidity and poor ventilation.",
        "organic_treatment": "Improve ventilation, remove affected leaves, apply copper-based fungicide.",
        "chemical_treatment": "Chlorothalonil or mancozeb-based fungicide per label instructions.",
        "prevention_tips": "Increase plant spacing, reduce humidity in greenhouses, avoid overhead watering.",
    },
    "septoria leaf spot": {
        "severity": "moderate",
        "causes": "Fungal pathogen Septoria lycopersici, spreads via splashing water.",
        "organic_treatment": "Remove lower infected leaves, apply copper-based fungicide.",
        "chemical_treatment": "Chlorothalonil-based fungicide per label instructions.",
        "prevention_tips": "Mulch to prevent soil splash, avoid overhead irrigation, rotate crops.",
    },
    "spider mites two spotted spider mite": {
        "severity": "moderate",
        "causes": "Tetranychus urticae infestation, thrives in hot, dry conditions.",
        "organic_treatment": "Insecticidal soap or neem oil; introduce predatory mites.",
        "chemical_treatment": "Miticide labeled for spider mites, rotate active ingredients.",
        "prevention_tips": "Maintain adequate irrigation, avoid dusty conditions, monitor regularly.",
    },
    "target spot": {
        "severity": "moderate",
        "causes": "Fungal pathogen Corynespora cassiicola, favored by warm, humid weather.",
        "organic_treatment": "Remove infected leaves, apply copper-based fungicide.",
        "chemical_treatment": "Chlorothalonil or azoxystrobin-based fungicide per label instructions.",
        "prevention_tips": "Crop rotation, avoid overhead watering, improve airflow.",
    },
    "tomato yellow leaf curl virus": {
        "severity": "critical",
        "causes": "Virus transmitted by whitefly (Bemisia tabaci).",
        "organic_treatment": "Remove and destroy infected plants; control whitefly populations with sticky traps and neem oil.",
        "chemical_treatment": "Insecticide targeting whitefly vector (e.g. imidacloprid) per label instructions.",
        "prevention_tips": "Use virus-resistant varieties, reflective mulch, whitefly-proof nursery screens.",
    },
    "tomato mosaic virus": {
        "severity": "moderate",
        "causes": "Virus spread by contact, contaminated tools, and hands.",
        "organic_treatment": "Remove and destroy infected plants; no cure once infected.",
        "chemical_treatment": "Not applicable — no chemical treatment for viral infection.",
        "prevention_tips": "Disinfect tools and hands, avoid tobacco use near plants, use resistant varieties.",
    },
    "common rust": {
        "severity": "moderate",
        "causes": "Fungal pathogen Puccinia sorghi, spreads via windborne spores.",
        "organic_treatment": "Remove severely infected leaves; sulfur-based fungicide.",
        "chemical_treatment": "Azoxystrobin or propiconazole-based fungicide per label instructions.",
        "prevention_tips": "Plant resistant hybrids, avoid dense planting, monitor early in the season.",
    },
    "northern leaf blight": {
        "severity": "moderate",
        "causes": "Fungal pathogen Exserohilum turcicum, favored by cool, humid conditions.",
        "organic_treatment": "Remove crop debris after harvest; rotate crops.",
        "chemical_treatment": "Strobilurin or triazole-based fungicide per label instructions.",
        "prevention_tips": "Resistant hybrids, crop rotation, residue management.",
    },
    "gray leaf spot": {
        "severity": "moderate",
        "causes": "Fungal pathogen Cercospora zeae-maydis, favored by warm, humid weather and crop residue.",
        "organic_treatment": "Rotate crops away from corn; till under residue.",
        "chemical_treatment": "Strobilurin-based fungicide per label instructions.",
        "prevention_tips": "Resistant hybrids, residue management, avoid continuous corn planting.",
    },
    "apple scab": {
        "severity": "moderate",
        "causes": "Fungal pathogen Venturia inaequalis, favored by wet spring weather.",
        "organic_treatment": "Rake and destroy fallen leaves; sulfur-based fungicide.",
        "chemical_treatment": "Myclobutanil or captan-based fungicide per label instructions.",
        "prevention_tips": "Resistant varieties, prune for airflow, remove fallen leaves in autumn.",
    },
    "black rot": {
        "severity": "moderate",
        "causes": "Fungal pathogen Botryosphaeria obtusa (apple) or Guignardia bidwellii (grape).",
        "organic_treatment": "Prune out infected wood/mummified fruit; copper-based fungicide.",
        "chemical_treatment": "Captan or myclobutanil-based fungicide per label instructions.",
        "prevention_tips": "Remove mummified fruit, prune for airflow, sanitize orchard/vineyard debris.",
    },
    "cedar apple rust": {
        "severity": "moderate",
        "causes": "Fungal pathogen Gymnosporangium juniperi-virginianae, requires nearby juniper/cedar host.",
        "organic_treatment": "Remove nearby juniper hosts if feasible; sulfur-based fungicide.",
        "chemical_treatment": "Myclobutanil-based fungicide per label instructions.",
        "prevention_tips": "Plant resistant varieties, remove cedar/juniper within a few hundred meters where practical.",
    },
    "esca black measles": {
        "severity": "critical",
        "causes": "Complex of wood-rotting fungi affecting grapevine trunk and wood.",
        "organic_treatment": "Prune out and destroy infected wood; no organic cure once established.",
        "chemical_treatment": "No fully effective chemical treatment; trunk surgery in severe cases.",
        "prevention_tips": "Avoid pruning wounds during wet weather, protect pruning cuts, remove severely affected vines.",
    },
    "leaf blight isariopsis leaf spot": {
        "severity": "moderate",
        "causes": "Fungal pathogen Pseudocercospora vitis, favored by warm, humid conditions.",
        "organic_treatment": "Remove infected leaves; copper-based fungicide.",
        "chemical_treatment": "Mancozeb-based fungicide per label instructions.",
        "prevention_tips": "Improve canopy airflow, avoid overhead irrigation.",
    },
    "powdery mildew": {
        "severity": "moderate",
        "causes": "Various fungal pathogens (e.g. Podosphaera, Erysiphe), favored by warm days and cool, humid nights.",
        "organic_treatment": "Sulfur-based fungicide, potassium bicarbonate spray, or milk spray (diluted).",
        "chemical_treatment": "Myclobutanil or triadimefon-based fungicide per label instructions.",
        "prevention_tips": "Improve airflow, avoid excess nitrogen, resistant varieties.",
    },
    "leaf scorch": {
        "severity": "moderate",
        "causes": "Fungal pathogen Diplocarpon earlianum (strawberry) or environmental stress.",
        "organic_treatment": "Remove infected leaves after harvest; copper-based fungicide.",
        "chemical_treatment": "Captan-based fungicide per label instructions.",
        "prevention_tips": "Avoid overhead irrigation, renovate beds annually, ensure good drainage.",
    },
    "haunglongbing citrus greening": {
        "severity": "critical",
        "causes": "Bacterium spread by the Asian citrus psyllid; currently incurable.",
        "organic_treatment": "Remove and destroy infected trees to slow spread; no organic cure.",
        "chemical_treatment": "Insecticide to control psyllid vector; no cure for infected trees.",
        "prevention_tips": "Control psyllid populations, use certified disease-free nursery stock, remove infected trees promptly.",
    },
}


def get_disease_info(label: str) -> dict:
    """Look up treatment info, trying the exact label first (in case
    labels.json already stores clean names), then a normalized match.
    Returns {} if nothing matches, so callers can safely .get() further.
    """
    if label in TREATMENT_LOOKUP:
        return TREATMENT_LOOKUP[label]
    return TREATMENT_LOOKUP.get(_normalize(label), {})


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
            info = TREATMENT_LOOKUP["early blight"]
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
        info = get_disease_info(label)

        return DetectionResponse(label=label, confidence=confidence, model_version=MODEL_VERSION, heatmap_url=heatmap_url, **info)

    def _generate_heatmap(self, image_url: str, tensor: np.ndarray) -> str | None:
        return None


def _softmax(x: np.ndarray) -> np.ndarray:
    exp = np.exp(x - np.max(x))
    return exp / exp.sum()