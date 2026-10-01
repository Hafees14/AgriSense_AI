# AgriSense AI

AI-powered agricultural decision support platform. Monorepo: Next.js frontend,
FastAPI core backend (MySQL), separate AI inference microservice.

## Contents

- [Run locally](#recommended-run-locally-with-pythonnode-no-docker-needed)
- [Machine learning models](#machine-learning-models)
- [Disease detection model](#disease-detection-model)
- [Known fixes already applied](#known-fixes-already-applied-in-this-build)
- [Docker Compose (optional)](#optional-docker-compose)
- [Repository layout](#repository-layout)

## Recommended: run locally with Python/Node (no Docker needed)

### 1. MySQL
```
mysql -u root -p
```
```sql
CREATE DATABASE agrisense_db;
CREATE USER 'agrisense'@'%' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON agrisense_db.* TO 'agrisense'@'%';
FLUSH PRIVILEGES;
EXIT;
```

Create `apps/api/.env` (copy `apps/api/.env.example`) and set DB_PASSWORD to match,
plus a random SECRET_KEY (`python -c "import secrets; print(secrets.token_hex(32))"`).

### 2. Backend API (Terminal 1, from repo root)
```
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1      # Windows
pip install -r requirements.txt
cd ../..
alembic -c apps/api/alembic.ini upgrade head
python -m apps.api.db.seed
uvicorn apps.api.main:app --reload --reload-exclude ".venv/*"
```
Check: http://localhost:8000/docs

### 3. Inference service (Terminal 2, new window, from repo root)
```
cd apps/inference
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ../..
uvicorn apps.inference.main:app --reload --reload-exclude ".venv/*" --port 8001
```
Check: http://localhost:8001/health

### 4. Frontend (Terminal 3, new window, from repo root)
```
cd apps/web
npm install
copy .env.example .env.local     # Windows; cp on Mac/Linux
npm run dev
```
Check: http://localhost:3000

## Machine learning models

The inference service (`apps/inference`) loads ONNX models from
`apps/inference/weights/`. If a model's weights are missing, its wrapper returns
a stub response (confidence 0.0, model version ending in `-stub`) so the rest of
the stack stays testable.

| Task | Model | Status |
|---|---|---|
| Disease detection | EfficientNet-B3, 38 classes | Trained (`disease-detect-efficientnet-b3-v2`) |
| Pest detection | YOLOv11 (nano/small) | Not trained yet |
| Plant identification | EfficientNet-B3 | Not trained yet |

## Disease detection model

A 38-class plant disease classifier (EfficientNet-B3), trained in Google Colab
and served as an ONNX model by the FastAPI inference service.

### Data

- **PlantVillage** (Kaggle, color version only): about 54,300 lab-condition leaf
  images, split 80/10/10 per class with a fixed seed.
  https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset
- **PlantDoc** (cropped classification version): about 2,600 real-world photos,
  used to test and fine-tune for field conditions.
  https://github.com/pratikkayal/PlantDoc-Dataset

### Training

- Transfer learning: ImageNet-pretrained EfficientNet-B3 (timm) at 300×300.
  First only the classifier head was trained, then the whole network.
- Settings: AdamW, label smoothing 0.1, mixed precision, and augmentation that
  imitates phone photos.
- Fine-tuning on field data: PlantDoc TRAIN (27 matched classes) mixed with a
  PlantVillage sample, with heavier augmentation.
- Calibration: temperature scaling (T = 0.842), fitted on PlantDoc validation
  images and built into the exported model.

### Results

| Model | PlantVillage test | PlantDoc (field photos) |
|---|---|---|
| PlantVillage only | 99.5% | 23.4% (all 2,576 images) |
| After fine-tuning | 99.2% | 72.9% (236 held-out TEST images) |

Notes on the numbers:

- The PlantDoc TEST score comes from only 236 images, so treat it as roughly
  ±5 points.
- PlantDoc is scraped from the internet, so some near-duplicates may exist
  between its train and test folders. That would make the figure slightly
  optimistic.
- The 99% PlantVillage figure reflects clean lab photos and should not be read
  as real-world accuracy.

### Deployment

- Model file: `apps/inference/weights/disease_detect.onnx`
  (input 1×3×300×300, output raw logits, opset 17). The ONNX output was verified
  against PyTorch (max difference about 1e-5) and against the backend's own
  preprocessing.
- Labels: `disease_labels.json` lists the 38 classes in alphabetical order,
  matching the training class order.
- Version: `MODEL_VERSION = "disease-detect-efficientnet-b3-v2"`.
- Code fix: `_normalize` in `disease_detect.py` was rewritten so all 38 labels
  match the treatment lookup (before, 11 classes returned empty advice).

### Known limitations

- It only knows the 38 crop/disease classes in the training data. Crops like
  rice, brinjal and chilli are not covered and will be forced into the nearest
  class.
- Field-photo accuracy is much lower than lab accuracy. The model also confuses
  visually similar classes, such as the corn leaf diseases.
- The heatmap is still a stub, and the pest and plant-ID models are not trained
  yet.

### Next steps

- Collect local (Sri Lankan) farm photos.
- Add a `corrected_label` field so expert corrections can be used for
  retraining.
- Add Grad-CAM heatmaps.
- Train the pest detector and plant-ID model.

## Known fixes already applied in this build
- `bcrypt==4.0.1` pinned in apps/api/requirements.txt (newer bcrypt breaks passlib 1.7.4)
- `email-validator` added to apps/api/requirements.txt (required by Pydantic EmailStr)
- Landing page "Create an account" link fixed to `/register` (not `/(auth)/register`)
- `protected_namespaces = ()` set on schemas using a `model_version` field (removes Pydantic warning)
- `apps/web/public/` folder included (was missing, broke Docker web build)
- Disease label normalization fixed so all 38 classes return treatment advice

## Optional: Docker Compose
```
cd infra
docker compose up --build
```
Local Python/Node is the more reliable path on Windows — Docker Desktop/WSL2
can be unstable on slower connections.

## Repository layout
```
agrisense-ai/
├── apps/
│   ├── web/          Next.js frontend
│   ├── api/           FastAPI core backend (MySQL)
│   └── inference/     AI inference microservice (ONNX Runtime)
├── packages/
│   └── shared-types/  TS types shared by the frontend
├── infra/             Docker Compose, Dockerfiles, CI/CD
└── docs/              Database ERD, ML architecture notes
```
