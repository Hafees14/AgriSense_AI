"""Pre-commit check for the disease model files.

Put this file anywhere in the repo (for example scripts/), activate the inference venv, then run:

    python check_disease_model.py                       # file checks only
    python check_disease_model.py rice.jpg tea.jpg      # file checks + predictions for your photos
"""
import sys
from pathlib import Path

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "apps" / "inference").is_dir())
sys.path.insert(0, str(ROOT))

import numpy as np
import onnxruntime as ort
from PIL import Image

from apps.inference.models.disease_detect import MODEL_VERSION, get_disease_info
from apps.inference.preprocessing.image_pipeline import preprocess_for_classification
from apps.inference.utils.labels import load_labels

WEIGHTS = ROOT / "apps" / "inference" / "weights"
EXPECTED_VERSION = "disease-detect-efficientnet-b3-v3"
problems = []

labels = load_labels(WEIGHTS / "disease_labels.json")
sess = ort.InferenceSession(str(WEIGHTS / "disease_detect.onnx"), providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0]
out = sess.get_outputs()[0]

print("MODEL_VERSION:", MODEL_VERSION)
print("ONNX input:", inp.shape, "| output:", out.shape, "| labels:", len(labels))

if MODEL_VERSION != EXPECTED_VERSION:
    problems.append(f"MODEL_VERSION should be {EXPECTED_VERSION}")
if len(labels) != 52:
    problems.append(f"expected 52 labels, found {len(labels)}")
if out.shape[-1] != len(labels):
    problems.append(f"model outputs {out.shape[-1]} classes but the labels file has {len(labels)}")

missing = [l for l in labels if not get_disease_info(l)]
print("labels without treatment advice:", missing or "none")
if missing:
    problems.append(f"{len(missing)} labels return empty advice")

coconut = get_disease_info("Coconut___Gray_leaf_spot")
if "zeae" in coconut.get("causes", ""):
    problems.append("Coconut___Gray_leaf_spot is returning the corn advice (check the get_disease_info patch)")

for path in sys.argv[1:]:
    x = preprocess_for_classification(Image.open(path).convert("RGB"))
    logits = sess.run(None, {inp.name: x})[0][0]
    e = np.exp(logits - logits.max())
    probs = e / e.sum()
    print(f"\n{path}")
    for i in np.argsort(probs)[::-1][:3]:
        print(f"  {probs[i]:.3f}  {labels[i]}")
    print("  severity:", get_disease_info(labels[int(np.argmax(probs))]).get("severity"))

print()
if problems:
    print("PROBLEMS:")
    for p in problems:
        print(" -", p)
    sys.exit(1)
print("ALL CHECKS PASSED")
