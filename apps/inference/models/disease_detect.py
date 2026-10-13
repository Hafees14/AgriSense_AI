import base64
import logging
import re
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

from apps.inference.preprocessing.image_pipeline import download_image, preprocess_for_classification
from apps.inference.schemas import DetectionResponse
from apps.inference.utils.labels import load_labels
from apps.inference.utils.weights import weights_usable
from apps.inference.models.local_crop_treatments import LOCAL_CROP_LOOKUP

logger = logging.getLogger("agrisense.inference")
HEATMAP_MIN_CONFIDENCE = 0.5
MODEL_VERSION = "disease-detect-efficientnet-b3-v3"
WEIGHTS_PATH = Path(__file__).resolve().parents[1] / "weights" / "disease_detect.onnx"
LABELS_PATH = Path(__file__).resolve().parents[1] / "weights" / "disease_labels.json"


def _normalize(label: str) -> str:
    """Turn a dataset label into the key format used by TREATMENT_LOOKUP.

    PlantVillage-style labels look like "Tomato___Early_blight",
    "Corn_(maize)___Common_rust_" or "Pepper,_bell___healthy". The crop name
    comes before "___", so everything up to and including it is dropped.
    Then every run of characters that is not a letter or digit (underscores,
    parentheses, commas, hyphens, spaces) becomes a single space and the
    result is lowercased, e.g.:

        "Grape___Esca_(Black_Measles)"  ->  "esca black measles"
        "Pepper,_bell___healthy"        ->  "healthy"
        "Corn_(maize)___Common_rust_"   ->  "common rust"

    Labels without "___" are normalized as a whole.
    """
    disease = label.split("___")[-1]
    disease = re.sub(r"[^a-zA-Z0-9]+", " ", disease)
    return disease.strip().lower()


# Keyed by normalized disease name (crop prefix stripped, lowercased,
# punctuation -> spaces) so this matches regardless of exact labels.json
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

# The PlantVillage corn label combines two names ("Cercospora_leaf_spot
# Gray_leaf_spot"), so it normalizes to this longer key. Point it at the
# existing gray leaf spot entry.
TREATMENT_LOOKUP["cercospora leaf spot gray leaf spot"] = TREATMENT_LOOKUP["gray leaf spot"]


def get_disease_info(label: str) -> dict:
    if label in LOCAL_CROP_LOOKUP:
        return LOCAL_CROP_LOOKUP[label]

    if label in TREATMENT_LOOKUP:
        return TREATMENT_LOOKUP[label]

    return TREATMENT_LOOKUP.get(_normalize(label), {})


class DiseaseDetector:
    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None
        self._labels: list[str] = []
        self.stub_reason: str | None = None
        if weights_usable(WEIGHTS_PATH, LABELS_PATH, "disease"):
            self._session = ort.InferenceSession(str(WEIGHTS_PATH), providers=["CPUExecutionProvider"])
            self._labels = load_labels(LABELS_PATH)
            n_out = self._session.get_outputs()[0].shape[-1]
            if isinstance(n_out, int) and n_out != len(self._labels):
                raise RuntimeError(
                    f"Disease model has {n_out} outputs but the labels file has {len(self._labels)} entries"
                )
        else:
            self.stub_reason = "weights missing or are a Git LFS pointer"

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

        heatmap_png_b64 = None
        if confidence >= HEATMAP_MIN_CONFIDENCE:
            try:
                png = occlusion_heatmap_png(self._session, input_name, tensor, top_idx, image)
                heatmap_png_b64 = base64.b64encode(png).decode("ascii")
            except Exception:  # the explanation is a bonus; never fail the diagnosis because of it
                logger.exception("Could not build the explanation heatmap")
        info = get_disease_info(label)

        return DetectionResponse(
            label=label, confidence=confidence, model_version=MODEL_VERSION, heatmap_png_b64=heatmap_png_b64, **info
        )


def _softmax(x: np.ndarray) -> np.ndarray:
    exp = np.exp(x - np.max(x))
    return exp / exp.sum()


def occlusion_heatmap_png(
    session: ort.InferenceSession,
    input_name: str,
    tensor: np.ndarray,
    class_idx: int,
    original: "Image.Image",
    patch: int = 100,
    stride: int = 50,
) -> bytes:
    """Explain a prediction by hiding parts of the leaf and watching the confidence fall.

    This is an *occlusion sensitivity map*, not Grad-CAM (Grad-CAM needs gradients, which an
    exported ONNX classifier does not provide). Areas whose removal lowers the confidence the
    most are the areas the model relied on. Returned as a PNG overlay.
    """
    import io

    from PIL import Image

    size = tensor.shape[-1]
    base = float(_softmax(session.run(None, {input_name: tensor})[0][0])[class_idx])
    starts = list(range(0, size - patch + 1, stride))
    batch, coords = [], []
    for y in starts:
        for x in starts:
            masked = tensor.copy()
            masked[:, :, y : y + patch, x : x + patch] = 0.0  # 0 = the dataset mean after normalisation
            batch.append(masked[0])
            coords.append((y, x))
    logits = session.run(None, {input_name: np.stack(batch).astype(np.float32)})[0]
    probs = np.exp(logits - logits.max(axis=1, keepdims=True))
    probs = probs / probs.sum(axis=1, keepdims=True)

    heat = np.zeros((size, size), dtype=np.float32)
    count = np.zeros((size, size), dtype=np.float32)
    for (y, x), p in zip(coords, probs[:, class_idx]):
        heat[y : y + patch, x : x + patch] += max(0.0, base - float(p))
        count[y : y + patch, x : x + patch] += 1.0
    heat = heat / np.maximum(count, 1.0)
    if heat.max() > 0:
        heat = heat / heat.max()

    # Simple blue -> yellow -> red colour ramp, blended over the photo.
    r = np.clip(heat * 2.0, 0, 1)
    g = np.clip(1.0 - np.abs(heat - 0.5) * 2.0, 0, 1)
    b = np.clip(1.0 - heat * 2.0, 0, 1)
    colour = (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)
    base_img = original.convert("RGB").resize((size, size))
    alpha = (0.15 + 0.55 * heat)[..., None]
    blended = (np.asarray(base_img) * (1 - alpha) + colour * alpha).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(blended).save(buf, format="PNG")
    return buf.getvalue()
