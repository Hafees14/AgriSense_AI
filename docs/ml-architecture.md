# Machine Learning Architecture

| Task | Model | Format |
|---|---|---|
| Plant/crop identification | EfficientNet-B3 | ONNX |
| Disease detection | EfficientNet-B4 | ONNX (explainable-AI heatmap hook) |
| Pest detection | YOLOv11 (nano/small) | ONNX |

Each model wrapper looks for weights under apps/inference/weights/. If absent,
falls back to a stub response so the rest of the stack stays testable before
training completes.

Datasets: PlantVillage, PlantDoc, IP102 (see proposal document for links).
