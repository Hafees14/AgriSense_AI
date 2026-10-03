# Machine Learning Architecture

| Task | Model | Format | Status |
|---|---|---|---|
| Plant/crop identification | EfficientNet-B3 | ONNX | Not trained yet (stub) |
| Disease detection | EfficientNet-B3, 52 classes, 300×300 input | ONNX (explainable-AI heatmap hook) | Trained, `disease-detect-efficientnet-b3-v3` |
| Pest detection | YOLOv11 (nano/small) | ONNX | Not trained yet |

Each model wrapper looks for weights under apps/inference/weights/. If absent,
falls back to a stub response so the rest of the stack stays testable before
training completes.

## Disease detection

- Classes: 52 (`Crop___Disease` names in `weights/disease_labels.json`). Indices
  0-37 are the PlantVillage-style classes in alphabetical order; rice, tea and
  coconut classes are appended after them.
- Input: 1×3×300×300, plain resize, ImageNet normalization. Output: raw logits
  with the calibration temperature built into the model.
- Heatmap: still a stub. Grad-CAM is planned.
- Treatment advice: `TREATMENT_LOOKUP` in `models/disease_detect.py` covers the
  original 38 classes. `models/local_crop_treatments.py` covers the 14 rice, tea
  and coconut classes and is looked up by the exact label.
- Low-confidence results are flagged for expert review by the API
  (`needs_expert_review` in `apps/api/services/inference_client.py`).
- Training is done in Google Colab and the ONNX file is copied into the repo.
  Training details and results are in the main README.

## Datasets

- Disease detection: PlantVillage, PlantDoc, Rice Leaf Disease Dataset, Sri
  Lankan Tea Leaf Dataset (SLTeaLeaf), Coconut Tree Disease Dataset.
- Pest detection (planned): IP102.

See the proposal document for links.
