# AgriSense AI

AI-powered agricultural decision support platform. Monorepo: Next.js frontend,
FastAPI core backend (MySQL, or SQLite for a zero-setup local run), separate AI
inference microservice.

> **A model prediction is not a guaranteed diagnosis.** Results come from a
> machine-learning model trained mostly on lab photos. Low-confidence results
> are flagged and their treatment advice is hidden. Treatment text is a draft
> that still needs review by an agronomist.

## Status (verified in this repository)

| Feature | Status |
|---|---|
| Register, login, refresh, logout, protected routes | Working, covered by automated tests |
| Disease detection (EfficientNet-B3, 52 classes) | Working end to end with the real model |
| Pest detection (YOLO, 5 rice pests) | Working: boxes, NMS, count. Not independently validated |
| Explanation heatmap | Working as an *occlusion sensitivity map* (not Grad-CAM) |
| Plant identification | **Not available**: no trained model. The API answers 503 and the UI shows "Coming soon" |
| Prediction history, farms, fields, notifications, outbreak map | Implemented, API tested for history only |
| MySQL | Migrations are tested in CI. The default local run uses SQLite unless `DB_HOST` is set |
| Docker Compose | Written but **not built or run by the author of this audit** (no Docker available there). CI builds it |

## Before you start: model files (Git LFS)

The `.onnx` model files are stored with **Git LFS**. A plain clone gives you
133-byte pointer files and the inference service will report `degraded` and
refuse to analyse. Install Git LFS and run:

```
git lfs install
git lfs pull
```

Check `http://localhost:8001/health`: `"status": "ok"` means both models loaded.

## Run the tests

```
pip install -r apps/api/requirements-dev.txt -r apps/inference/requirements.txt
python -m pytest tests -q          # real-model tests are skipped if the weights are LFS pointers
cd apps/web && npm run typecheck && npm run lint && npm run build
```

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
With `DB_HOST` set, the API connects to MySQL using the `DB_*` values (or set
`DATABASE_URL` yourself). With neither set it uses a local SQLite file, which is
fine for a quick try but is not what you deploy. If `ENV` is not `development`,
the API refuses to start unless `SECRET_KEY` is at least 32 characters.

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
`apps/inference/weights/`. If a model's weights are missing (or are Git LFS
pointers), its wrapper returns a stub response (confidence 0.0, model version
ending in `-stub`). The core API **rejects stub results with a 503**, so a fake
result can never be shown or saved as a real diagnosis. `/health` on the
inference service lists which models are really loaded.

| Task | Model | Status |
|---|---|---|
| Disease detection | EfficientNet-B3, 52 classes (17 crops) | Trained (`disease-detect-efficientnet-b3-v3`) |
| Pest detection | YOLO (Ultralytics export, 5 rice pest classes) | `pest-detect-yolov11s-v2`, weights present, not independently validated |
| Plant identification | EfficientNet-B3 | Not trained yet. No weights, so the feature is disabled |

## Disease detection model

A 52-class plant disease classifier (EfficientNet-B3), trained in Google Colab
and served as an ONNX model by the FastAPI inference service. Version 2 covered
38 classes from PlantVillage and PlantDoc. Version 3 adds rice, tea and coconut,
the main Sri Lankan crops.

### Data

- **PlantVillage** (Kaggle, color version only): about 54,300 lab-condition leaf
  images, split 80/10/10 per class with a fixed seed.
  https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset
- **PlantDoc** (cropped classification version): about 2,600 real-world photos,
  used to test and fine-tune for field conditions.
  https://github.com/pratikkayal/PlantDoc-Dataset
- **Rice Leaf Disease Dataset** (3 classes): 1,914 images, but only about 350
  distinct photos, because the rest are augmented copies. The split that came
  with it put the same photo in train and test, so it was re-split by original
  photo (210 / 69 / 70 photos for train / validation / test).
- **Sri Lankan Tea Leaf Dataset, SLTeaLeaf** (6 classes): 1,791 original photos
  plus offline-augmented copies. The dataset's own split by base photo ID was
  used. Augmented copies are in the training set only, and the validation and
  test sets contain original photos only. The photos are padded to a white
  square, so the padding is trimmed before training.
- **Coconut Tree Disease Dataset** (5 classes): about 5,800 photos with no
  metadata. Consecutive photo numbers were assumed to come from the same tree,
  so photos were split in blocks of 25 consecutive numbers per class.
  Training is capped at 1,000 photos per class.

### Dataset coverage

The datasets together cover 17 crops. The model's 52 classes follow the
PlantVillage naming (`Crop___Disease`). PlantDoc has no Orange images, so
Orange comes from PlantVillage only. 27 PlantDoc classes were matched to the
model's classes for fine-tuning and testing.

| Crop | Classes in the model |
|---|---|
| Apple | Scab, Black rot, Cedar apple rust, Healthy |
| Blueberry | Healthy |
| Cherry | Powdery mildew, Healthy |
| Coconut | Bud root dropping, Bud rot, Gray leaf spot, Leaf rot, Stem bleeding |
| Corn (maize) | Gray leaf spot (Cercospora), Common rust, Northern leaf blight, Healthy |
| Grape | Black rot, Esca (black measles), Leaf blight, Healthy |
| Orange | Huanglongbing (citrus greening) |
| Peach | Bacterial spot, Healthy |
| Bell pepper | Bacterial spot, Healthy |
| Potato | Early blight, Late blight, Healthy |
| Raspberry | Healthy |
| Rice | Bacterial leaf blight, Brown spot, Leaf blast |
| Soybean | Healthy |
| Squash | Powdery mildew |
| Strawberry | Leaf scorch, Healthy |
| Tea | Algal leaf spot, Black blight, Blister blight, Gray blight, Spider mites, Healthy |
| Tomato | Bacterial spot, Early blight, Late blight, Leaf mold, Septoria leaf spot, Spider mites, Target spot, Mosaic virus, Yellow leaf curl virus, Healthy |

The same disease is named differently in different datasets (for example PlantDoc
"Tomato leaf bacterial spot" and PlantVillage "Tomato___Bacterial_spot"). Each
disease must map to one class, otherwise the model gets duplicate classes for
the same disease.

### Training

Version 2 (38 classes):

- Transfer learning: ImageNet-pretrained EfficientNet-B3 (timm) at 300×300.
  First only the classifier head was trained, then the whole network.
- Settings: AdamW, label smoothing 0.1, mixed precision, and augmentation that
  imitates phone photos.
- Fine-tuning on field data: PlantDoc TRAIN (27 matched classes) mixed with a
  PlantVillage sample, with heavier augmentation.

Version 3 (52 classes):

- Started from the v2 weights. The classifier was widened from 38 to 52 outputs,
  and the old class rows were copied, so the first 38 class indices did not
  change.
- Phase A: 2 epochs training only the classifier (learning rate 1e-3). Phase B:
  8 epochs training the whole network (learning rate 1e-4, cosine schedule).
- Each epoch mixes the new crops with PlantDoc train (twice) and a PlantVillage
  sample, so the old classes are not forgotten. Rarer classes are sampled more
  often (weight 1 / sqrt of class size).
- The best epoch was chosen by the average validation accuracy over the five
  data sources.
- Calibration: temperature scaling fitted on the validation images of PlantDoc,
  rice, tea and coconut, and built into the exported model.

### Results

Accuracy on held-out test images:

| Test set | Images | v2 | v3 |
|---|---|---|---|
| PlantVillage (lab photos) | 5,459 | 99.2% | 99.2% |
| PlantDoc (field photos) | 236 | 72.9% | 71.6% |
| Rice | 385 | n/a | 99.5% |
| Tea, all photos | 538 | n/a | 94.2% |
| Tea, field photos only | 341 | n/a | 92.7% |
| Tea, controlled-environment photos | 197 | n/a | 97.0% |
| Coconut | 1,137 | n/a | 98.8% |

Weakest classes:

- Tea Gray blight: 83.8% recall. It is mostly confused with Blister blight and
  Black blight. Blister blight has 74.5% precision (only 38 test images).
- Coconut Leaf rot and Gray leaf spot are confused with each other (13 mistakes
  out of 723 test images of the two classes).
- None of the 2,060 rice, tea and coconut test images was predicted as one of
  the original 38 classes.

Notes on the numbers:

- The PlantDoc TEST score comes from only 236 images, so treat it as roughly
  ±5 points. The change from 72.9% to 71.6% is 3 images and is within that
  noise.
- The rice test set has only about 70 distinct photos (385 files include
  augmented copies), so treat the rice score as roughly ±10 points.
- Coconut photos were split by an assumption (consecutive photo numbers belong
  together), so near-duplicates may still sit on both sides of the split. That
  would make the coconut score optimistic.
- The rice, tea and coconut test photos come from the same datasets as their
  training photos. Like the 99% PlantVillage figure, they are not real-farm
  accuracy. The earlier PlantVillage-only model scored 99.5% on lab photos but
  only 23.4% on PlantDoc field photos. The new crops have not yet been tested on
  independent photos.
- The 99% PlantVillage figure reflects clean lab photos and should not be read
  as real-world accuracy.

### Deployment

- Model file: `apps/inference/weights/disease_detect.onnx`
  (input 1×3×300×300, output raw logits for 52 classes, opset 17). The ONNX
  output matches PyTorch (max logit difference about 9e-6, same predictions) and
  gives the same accuracy through the backend's own preprocessing (PlantDoc
  71.6%). On a 300-image tea sample, accuracy was 94.3% with the white padding
  left in and 94.0% with it trimmed, so the model does not depend on the padding.
- Labels: `disease_labels.json` lists the 52 classes. Indices 0-37 are the
  original classes in alphabetical order, followed by rice, tea and coconut.
- Version: `MODEL_VERSION = "disease-detect-efficientnet-b3-v3"`.
- Treatment advice for the 38 original classes comes from `TREATMENT_LOOKUP` in
  `disease_detect.py` (`_normalize` was rewritten so all 38 labels match; before,
  11 classes returned empty advice). Advice for the 14 new classes is in
  `apps/inference/models/local_crop_treatments.py`, looked up by the exact label,
  because stripping the crop name would make "Coconut gray leaf spot" match the
  corn entry.

### Known limitations

- It only knows the 52 crop/disease classes in the training data. Crops like
  brinjal and chilli are not covered and will be forced into the nearest class.
- Blueberry, raspberry and soybean only have a "healthy" class, so the model
  cannot report a disease for them. Orange, squash, rice and coconut only have
  disease classes and no healthy class, so any leaf of those crops tends to be
  pushed toward one of their diseases.
- Coconut classes cover whole-tree symptoms (crown, stem and leaves), not only
  leaves. Only gray leaf spot and leaf rot are leaf diseases.
- Field-photo accuracy is much lower than lab accuracy. The model also confuses
  visually similar classes, such as the corn leaf diseases, tea gray blight and
  blister blight, and coconut leaf rot and gray leaf spot.
- The treatment text for rice, tea and coconut is a draft and still needs review
  by an agronomist. The entries for tea black blight and coconut bud root dropping
  need expert confirmation of the exact disease.
- The heatmap is an occlusion sensitivity map (it hides parts of the leaf and
  measures how the confidence drops). It is an aid, not proof of what the model
  "looked at". It adds about 3 seconds on a CPU. Grad-CAM is not possible with
  the exported ONNX file.
- The pest model has no independent evaluation in this repository, and there is
  no plant-identification model.
- Results below 70% confidence are marked "needs expert review", shown as a
  possible match only, and their treatment advice is hidden.

### Next steps

- Collect local (Sri Lankan) farm photos and test rice, tea and coconut on them.
- Collect healthy rice and coconut leaf photos and add healthy classes.
- Add a `corrected_label` field so expert corrections can be used for
  retraining.
- Evaluate the models on independent field photos (per-class precision/recall, confusion matrix).
- Evaluate the pest detector properly and train a plant-ID model.
- Have an agronomist review the treatment advice.

## Known fixes already applied in this build
- `bcrypt==4.0.1` pinned in apps/api/requirements.txt (newer bcrypt breaks passlib 1.7.4)
- `email-validator` added to apps/api/requirements.txt (required by Pydantic EmailStr)
- Landing page "Create an account" link fixed to `/register` (not `/(auth)/register`)
- `protected_namespaces = ()` set on schemas using a `model_version` field (removes Pydantic warning)
- `apps/web/public/` folder included (was missing, broke Docker web build)
- Disease label normalization fixed so all 38 original classes return treatment advice
- Treatment advice added for the rice, tea and coconut classes (`local_crop_treatments.py`)
- Pest detection model version updated to `pest-detect-yolov11s-v2` (`apps/inference/models/pest_detect.py`)
- Added treatment, causes, and prevention guidance for rice pests: brown plant hopper, rice gall midge, and rice leaf hopper

## Security notes

- `SECRET_KEY` must be strong outside development (enforced at startup).
- The inference service only fetches images from allowed hosts
  (`INFERENCE_ALLOWED_IMAGE_HOSTS`, default `localhost,127.0.0.1,api`) and, if
  `INFERENCE_API_KEY` is set (same value on both services), requires the
  `X-Inference-Key` header. Set it for any shared or deployed setup.
- Uploads are checked by decoding the image, not by trusting the browser's
  content type. Photos are served from `/uploads/<user>/<random-name>`; the
  names cannot be guessed but the URLs are not login-protected.
- Rate limiting is in memory, per process. Use a shared store (for example
  Redis) if you run more than one API process.

## Optional: Docker Compose
```
cd infra
cp .env.example .env          # set the passwords
git lfs pull                  # real model files are required
docker compose up --build
```
Open http://localhost:3000. The API is on port 8002. The inference build fails
on purpose if the model files are still LFS pointers.
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
