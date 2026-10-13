# Machine Learning Architecture

| Task | Model | Format | Status |
|---|---|---|---|
| Plant/crop identification | EfficientNet-B3 | ONNX | Not trained yet (stub) |
| Disease detection | EfficientNet-B3, 52 classes, 300×300 input | ONNX (occlusion-sensitivity heatmap) | Trained, `disease-detect-efficientnet-b3-v3` |
| Pest detection | YOLO (Ultralytics export), 9 rice pests, 640×640 | ONNX | Trained, `pest-detect-yolov11s-v3` (mAP50 0.787, mAP50-95 0.441) |

Each model wrapper looks for weights under apps/inference/weights/. If absent,
falls back to a stub response. The core API rejects stub results (503), so they
are never shown or saved as real diagnoses. Weights stored as Git LFS pointers
count as absent.

## Disease detection

- Classes: 52 (`Crop___Disease` names in `weights/disease_labels.json`). Indices
  0-37 are the PlantVillage-style classes in alphabetical order; rice, tea and
  coconut classes are appended after them.
- Input: 1×3×300×300, plain resize, ImageNet normalization. Output: raw logits
  with the calibration temperature built into the model.
- Heatmap: occlusion sensitivity map (works with the exported ONNX model). True Grad-CAM needs gradients and is not possible from the ONNX file.
- Treatment advice: `TREATMENT_LOOKUP` in `models/disease_detect.py` covers the
  original 38 classes. `models/local_crop_treatments.py` covers the 14 rice, tea
  and coconut classes and is looked up by the exact label.
- Low-confidence results are flagged for expert review by the API
  (`needs_expert_review` in `apps/api/services/inference_client.py`).
- Training is done in Google Colab and the ONNX file is copied into the repo.
  Training details and results are in the main README.

## Pest detection

- Classes: 9 rice pest classes (`weights/pest_labels.json`):
  0. Brown Plant Hopper
  1. Rice Gall Midge
  2. Rice Leaf Hopper
  3. Rice Leaf Roller
  4. Stem Borer (merging Asiatic and Yellow Rice Borer)
  5. White Backed Plant Hopper
  6. Small Brown Plant Hopper
  7. Rice Water Weevil
  8. Rice Leaf Caterpillar
- Model: YOLOv11s ONNX export (`pest-detect-yolov11s-v3`), input 1×3×640×640, output 1×13×8400 (4 box values + 9 classes).
- Inference: letterbox preprocessing and non-maximum suppression (conf 0.25, IoU 0.45). The stored diagnosis records the primary label, confidence, and detection count.
- Performance (evaluated on 115 test images):
  - Overall mAP50: **0.787**, mAP50-95: **0.441**
  - Strong classes: Rice Water Weevil (0.995 mAP50), Rice Gall Midge (0.952), Rice Leaf Hopper (0.905), Stem Borer (0.839)
  - Moderate classes: Rice Leaf Roller (0.808), White Backed Plant Hopper (0.768), Small Brown Plant Hopper (0.756)
  - Weaker classes: Rice Leaf Caterpillar (0.555), Brown Plant Hopper (0.504)
- Dataset credit: Trained on the IP102 benchmark dataset (Wu et al., CVPR 2019). IP102 is subject to its non-commercial academic research license.

## Datasets

- Disease detection: PlantVillage, PlantDoc, Rice Leaf Disease Dataset, Sri
  Lankan Tea Leaf Dataset (SLTeaLeaf), Coconut Tree Disease Dataset.
- Pest detection: IP102 (9 rice pest classes).

See the proposal document for links.
