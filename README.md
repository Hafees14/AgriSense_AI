# AgriSense AI

![CI](https://github.com/OWNER/AgriSense_AI/actions/workflows/ci.yml/badge.svg)

AgriSense AI helps farmers find out what is wrong with a crop. The farmer takes a photo of a leaf or pest, and the app suggests the likely disease or pest, says how sure it is, and gives advice on treatment and prevention. A built-in AI assistant (Google Gemini) answers follow-up questions in English, Sinhala and Tamil. It was built by team TIMESWARE for the AgriTech Startup Spark 2026 competition.

**A prediction is not a diagnosis.** The results come from machine-learning models trained mostly on lab photos. When the model is not sure (below 70% confidence), the app says so, shows the result only as a "possible match", and hides the treatment advice. The treatment text is a draft that an agronomist has not reviewed yet. The AI assistant can also make mistakes. Always check with a local agriculture officer before spraying anything.

## Contents

- [What the app does](#what-the-app-does)
- [Current status](#current-status)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Before you start: model files (Git LFS)](#before-you-start-model-files-git-lfs)
- [Quick start with Docker](#quick-start-with-docker)
- [Run locally without Docker](#run-locally-without-docker)
- [Configuration](#configuration)
- [AI assistant (Gemini)](#ai-assistant-gemini)
- [Tests](#tests)
- [Machine learning models](#machine-learning-models)
- [Disease detection model](#disease-detection-model)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Disclaimer](#disclaimer)

## What the app does

- **Disease detection:** upload a leaf photo, get a disease name, a confidence score, severity, causes, organic and chemical treatment, and prevention tips.
- **Pest detection:** detection, bounding boxes, counts, causes, organic and chemical treatment, and prevention tips for nine common rice pests.
- **Explanation heatmap:** a picture that shows which parts of the leaf affected the result most.
- **AI assistant:** a chat that answers farming questions and can explain a saved diagnosis. Powered by the Gemini API (the free tier is enough for a demo).
- **Expert review:** low-confidence results go to a queue for agriculture officers.
- **History:** every successful diagnosis is saved for the user.
- **Also:** farms and fields, weather, recommendations, outbreak map, notifications.
- **Three languages:** English, Sinhala and Tamil.
- **Weak connection support:** photos taken offline are queued and sent later.

## Current status

| Feature | Status |
|---|---|
| Register, login, refresh, logout, protected routes | Working. Covered by automated tests |
| Disease detection (EfficientNet-B3, 52 classes) | Working end to end with the real model |
| Pest detection (YOLOv11s-v3, 9 rice pests) | Working (mAP50 0.787, mAP50-95 0.441 on 115 test images) |
| Explanation heatmap | Working as an occlusion sensitivity map (not Grad-CAM) |
| AI assistant (Gemini) | Needs `GEMINI_API_KEY`. Without a key the chat returns a clear 503 and the rest of the app works |
| Plant identification | Not available. No trained model exists. The API answers 503 and the app shows "Coming soon" |
| History, farms, fields, notifications, outbreak map | Implemented. Only history has automated API tests |
| Database | MySQL for real use. SQLite for a quick local try. Migrations run in CI against MySQL |
| Docker Compose | Builds and starts on the team's machines. CI also builds the images |
| CI | Workflow in `.github/workflows/ci.yml`. Check the Actions tab for the latest result |
| Frontend dependency audit | `npm audit` reported 13 issues (1 critical, 10 high, 2 moderate). Not fixed yet |
| Accuracy on real farm photos | Not measured yet |

## Architecture

```
Browser ──> Next.js web app (port 3000)
                │
                ▼
          FastAPI core API (port 8000, or 8002 in Docker)
           │          │               │
           ▼          ▼               ▼
        MySQL   Inference service   Gemini API (Google, over HTTPS)
   (users,      (port 8001)         text-only chat, key kept on the server
    history,        │
    farms,          ▼
    sessions)   ONNX models: disease, pest
```

1. The web app sends the photo to the core API.
2. The API checks the image, saves it, and asks the inference service to analyse it.
3. The inference service fetches the image from the API, runs the ONNX model, and returns the label, confidence, advice and (for diseases) a heatmap.
4. The API stores the result and returns it to the web app.
5. For chat, the web app sends text to the core API. The API adds a safety prompt and the diagnosis summary, calls Gemini, and returns the answer. The browser never sees the Gemini key, and photos are never sent to Gemini.

If the inference service is down, or its model files are missing, the API returns a clear 503 error and saves nothing.

**Technology:** Next.js 14 and TypeScript, Tailwind CSS, FastAPI, SQLAlchemy and Alembic, MySQL 8, ONNX Runtime, Google Gemini API (`google-genai`), Docker Compose, GitHub Actions.

## Repository layout

```
AgriSense_AI/
├── apps/
│   ├── web/             Next.js frontend
│   ├── api/             FastAPI core API (routers, models, services, migrations)
│   └── inference/       Inference service (ONNX models, preprocessing, advice text)
├── packages/
│   └── shared-types/    TypeScript types shared by the frontend
├── infra/               docker-compose.yml, Dockerfiles, .env.example
├── tests/               Automated tests (API and inference)
├── docs/                Database ERD, ML architecture, disease model notes
├── scripts/             check_disease_model.py
└── .github/workflows/   CI
```

## Before you start: model files (Git LFS)

The `.onnx` model files are stored with Git LFS. A normal clone gives you small pointer files (about 133 bytes) instead of the models. The inference service then reports `degraded`, and the API refuses to return results. Run:

```bash
git lfs install
git lfs pull
```

Then open http://localhost:8001/health once the inference service is running. `"status": "ok"` means the disease and pest models are loaded. Plant identification will show `loaded: false`, which is expected.

GitHub's free Git LFS plan has a monthly bandwidth limit. If `git lfs pull` fails with a quota error, download the weights from the team's shared drive and place them in `apps/inference/weights/`.

## Quick start with Docker

Needs Docker and Git LFS.

```bash
git lfs pull
cp apps/api/.env.example apps/api/.env       # set SECRET_KEY, GEMINI_API_KEY
cd infra
cp .env.example .env                         # set the passwords in infra/.env
docker compose up --build
```

| Service | Address |
|---|---|
| Web app | http://localhost:3000 |
| API (interactive docs at `/docs`) | http://localhost:8002 |
| Inference service (health) | http://localhost:8001/health (localhost only) |

The inference image refuses to build if the model files are still LFS pointers. Uploaded photos and the database are kept in Docker volumes.

On Windows, Docker Desktop with WSL2 can be slow or unstable on weak connections. The local setup below is a good alternative.

## Run locally without Docker

You need Python 3.12, Node 20 and Git LFS. MySQL is optional (see step 1).

### 1. Database

**Quick try:** skip this step. If neither `DB_HOST` nor `DATABASE_URL` is set, the API uses a local SQLite file.

**MySQL (recommended for anything real):**

```sql
CREATE DATABASE agrisense_db;
CREATE USER 'agrisense'@'%' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON agrisense_db.* TO 'agrisense'@'%';
FLUSH PRIVILEGES;
```

Copy `apps/api/.env.example` to `apps/api/.env`, set `DB_PASSWORD` to match, and set `SECRET_KEY` to a random value:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Core API (terminal 1, from the repo root)

```bash
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1      Mac/Linux: source .venv/bin/activate
pip install -r apps/api/requirements.txt
alembic -c apps/api/alembic.ini upgrade head
python -m apps.api.db.seed
uvicorn apps.api.main:app --reload --reload-dir apps
```

Check: http://localhost:8000/docs

### 3. Inference service (terminal 2, from the repo root)

```bash
pip install -r apps/inference/requirements.txt
uvicorn apps.inference.main:app --reload --reload-dir apps --port 8001
```

Check: http://localhost:8001/health

### 4. Web app (terminal 3)

```bash
cd apps/web
npm install
cp .env.example .env.local        # Windows: copy .env.example .env.local
npm run dev
```

Open http://localhost:3000

## Configuration

Never commit real secrets. `.env` files are ignored by git.

**Core API (`apps/api/.env`)**

| Variable | Meaning |
|---|---|
| `ENV` | `development` (default) or `production`. Outside development the API will not start with a weak `SECRET_KEY` |
| `SECRET_KEY` | Signs login tokens. Must be at least 32 random characters outside development |
| `DATABASE_URL` | Full database URL. If empty: MySQL is built from `DB_*` when `DB_HOST` is set, otherwise SQLite |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `INFERENCE_SERVICE_URL` | Where the inference service is (default `http://localhost:8001`) |
| `INFERENCE_API_KEY` | Shared secret sent to the inference service. Set the same value on both |
| `API_PUBLIC_URL` | Public address of the API. Used to build photo links |
| `INTERNAL_API_URL` | Docker only. How the inference container reaches the API. Leave empty otherwise |
| `CORS_ORIGINS` | Allowed web origins, as a JSON list |
| `GEMINI_API_KEY` | Key from https://aistudio.google.com/apikey. Empty means the assistant is switched off |
| `GEMINI_MODEL` | Gemini model name. Check AI Studio for the free models available to your key |
| `ASSISTANT_DAILY_LIMIT` | Max assistant messages per user per day (default 30) |
| `DEBUG` | `true` prints SQL to the log. Keep it `false` |

**Inference service (environment variables)**

| Variable | Meaning |
|---|---|
| `INFERENCE_API_KEY` | If set, every request must send it in the `X-Inference-Key` header |
| `INFERENCE_ALLOWED_IMAGE_HOSTS` | Hosts the service may download images from (default `localhost,127.0.0.1,api`) |

**Web app (`apps/web/.env.local`)**

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Address of the core API as the browser sees it |

**Docker (`infra/.env`)**

| Variable | Meaning |
|---|---|
| `MYSQL_ROOT_PASSWORD` | Required |
| `MYSQL_PASSWORD` | Password for the app's database user |
| `INFERENCE_API_KEY` | Shared secret between the API and the inference service |

## AI assistant (Gemini)

The assistant runs only on the backend. The web app calls `POST /assistant/chat` on the core API, and the API calls Gemini.

**Get a free key**

1. Open https://aistudio.google.com/apikey and sign in with a Google account.
2. Create an API key and put it in `apps/api/.env` as `GEMINI_API_KEY`.
3. Restart the API.

**Behaviour**

- Text only. Leaf photos are never sent to Gemini.
- The system prompt tells the model to answer only about farming, to reply in the user's language, to avoid exact pesticide doses, and to point to a local agriculture officer for anything serious.
- If a diagnosis is attached and its confidence is below 70%, the assistant is told to treat it as unconfirmed and not to give treatment advice.
- The free tier has low per-minute and per-day limits shared by all users of the key. When Google returns 429, the API answers 429 with a friendly message. `ASSISTANT_DAILY_LIMIT` caps each user so one person cannot use the whole quota.
- Google may use free-tier prompts to improve its products. Do not send names, phone numbers or exact farm locations in chat.

**Quick test**

```bash
curl -X POST http://localhost:8000/assistant/chat \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I prevent rice blast?", "language": "en"}'
```

## Tests

```bash
pip install -r apps/api/requirements-dev.txt -r apps/inference/requirements.txt
python -m pytest tests -q
```

The tests cover login and sessions, image upload checks, ownership rules, inference error handling, the image-fetch guard, pest box decoding, the assistant, and real inference. Four tests run the real models and are skipped if the weights are still LFS pointers. Tests use a temporary SQLite database and do not touch your data. Gemini calls are mocked, so the tests need no API key.

Frontend checks:

```bash
cd apps/web
npm run typecheck
npm run lint
npm run build
```

There are no automated frontend tests yet.

## Machine learning models

The inference service loads ONNX models from `apps/inference/weights/`. If a model's weights are missing or are Git LFS pointers, its wrapper returns a stub response (confidence 0.0, model version ending in `-stub`). The core API rejects stub results with a 503, so a fake result is never shown or saved.

| Task | Model | Status |
|---|---|---|
| Disease detection | EfficientNet-B3, 52 classes (17 crops), 300×300 input | Trained: `disease-detect-efficientnet-b3-v3` |
| Pest detection | YOLOv11s-v3 (Ultralytics ONNX export), 9 rice pests, 640×640 input | Trained: `pest-detect-yolov11s-v3` (mAP50 0.787, mAP50-95 0.441 on 115 test images) |
| Plant identification | EfficientNet-B3 | No trained model. The feature is turned off |

### Pest detection

Supported rice pest classes (9):

1. Brown Plant Hopper (*Nilaparvata lugens*)
2. Rice Gall Midge (*Orseolia oryzae*)
3. Rice Leaf Hopper (*Nephotettix virescens*)
4. Rice Leaf Roller (*Cnaphalocrocis medinalis*)
5. Stem Borer (*Scirpophaga incertulas* / *Chilo suppressalis*)
6. White Backed Plant Hopper (*Sogatella furcifera*)
7. Small Brown Plant Hopper (*Laodelphax striatellus*)
8. Rice Water Weevil (*Lissorhoptrus oryzophilus*)
9. Rice Leaf Caterpillar (*Naranga aenescens*)

All 9 pests have bounding box detection with letterbox preprocessing (keeps the aspect ratio), duplicate suppression (non-max suppression: confidence 0.25, overlap 0.45), pest counts, and full advisory entries (causes, organic and chemical management, and prevention). The wrapper returns every box it finds. The stored diagnosis records the primary pest detection, the bounding boxes, and the confidence.

The pest model is YOLOv11s-v3 trained on IP102 (9 rice pest classes, merging Asiatic and Yellow Rice Borer into Stem Borer). The score of mAP50 0.787 and mAP50-95 0.441 is on the IP102 test split (115 images). It has not yet been tested on independent Sri Lankan farm photos. IP102 (Wu et al., CVPR 2019) is used under its academic research license.

### Heatmap

For disease results with at least 50% confidence, the service hides parts of the leaf one at a time and measures how much the confidence drops. Areas that matter most show brighter. This is an occlusion sensitivity map, not Grad-CAM, because an exported ONNX model has no gradients. It takes about 3 seconds on a CPU.

## Disease detection model

A 52-class plant disease classifier (EfficientNet-B3), trained in Google Colab and served as an ONNX model by the FastAPI inference service. Version 2 covered 38 classes from PlantVillage and PlantDoc. Version 3 adds rice, tea and coconut, the main Sri Lankan crops. More notes are in `docs/disease-model.md`.

### Data

- **PlantVillage** (Kaggle, color version only): about 54,300 lab-condition leaf images, split 80/10/10 per class with a fixed seed. https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset
- **PlantDoc** (cropped classification version): about 2,600 real-world photos, used to test and fine-tune for field conditions. https://github.com/pratikkayal/PlantDoc-Dataset
- **Rice Leaf Disease Dataset** (3 classes): 1,914 images, but only about 350 distinct photos, because the rest are augmented copies. The split that came with it put the same photo in train and test, so it was re-split by original photo (210 / 69 / 70 photos for train / validation / test).
- **Sri Lankan Tea Leaf Dataset, SLTeaLeaf** (6 classes): 1,791 original photos plus offline-augmented copies. The dataset's own split by base photo ID was used. Augmented copies are in the training set only, and the validation and test sets contain original photos only. The photos are padded to a white square, so the padding is trimmed before training.
- **Coconut Tree Disease Dataset** (5 classes): about 5,800 photos with no metadata. Consecutive photo numbers were assumed to come from the same tree, so photos were split in blocks of 25 consecutive numbers per class. Training is capped at 1,000 photos per class.

### Dataset coverage

The datasets together cover 17 crops. The model's 52 classes follow the PlantVillage naming (`Crop___Disease`). PlantDoc has no Orange images, so Orange comes from PlantVillage only. 27 PlantDoc classes were matched to the model's classes for fine-tuning and testing.

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

The same disease is named differently in different datasets (for example PlantDoc "Tomato leaf bacterial spot" and PlantVillage "Tomato___Bacterial_spot"). Each disease must map to one class, otherwise the model gets duplicate classes for the same disease.

### Training

**Version 2 (38 classes):**

- Transfer learning: ImageNet-pretrained EfficientNet-B3 (timm) at 300×300. First only the classifier head was trained, then the whole network.
- Settings: AdamW, label smoothing 0.1, mixed precision, and augmentation that imitates phone photos.
- Fine-tuning on field data: PlantDoc TRAIN (27 matched classes) mixed with a PlantVillage sample, with heavier augmentation.

**Version 3 (52 classes):**

- Started from the v2 weights. The classifier was widened from 38 to 52 outputs, and the old class rows were copied, so the first 38 class indices did not change.
- Phase A: 2 epochs training only the classifier (learning rate 1e-3). Phase B: 8 epochs training the whole network (learning rate 1e-4, cosine schedule).
- Each epoch mixes the new crops with PlantDoc train (twice) and a PlantVillage sample, so the old classes are not forgotten. Rarer classes are sampled more often (weight 1 / sqrt of class size).
- The best epoch was chosen by the average validation accuracy over the five data sources.
- Calibration: temperature scaling fitted on the validation images of PlantDoc, rice, tea and coconut, and built into the exported model.

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

**Weakest classes:**

- Tea Gray blight: 83.8% recall. It is mostly confused with Blister blight and Black blight. Blister blight has 74.5% precision (only 38 test images).
- Coconut Leaf rot and Gray leaf spot are confused with each other (13 mistakes out of 723 test images of the two classes).
- None of the 2,060 rice, tea and coconut test images was predicted as one of the original 38 classes.

**Notes on the numbers:**

- The PlantDoc TEST score comes from only 236 images, so treat it as roughly ±5 points. The change from 72.9% to 71.6% is 3 images and is within that noise.
- The rice test set has only about 70 distinct photos (385 files include augmented copies), so treat the rice score as roughly ±10 points.
- Coconut photos were split by an assumption (consecutive photo numbers belong together), so near-duplicates may still sit on both sides of the split. That would make the coconut score optimistic.
- The rice, tea and coconut test photos come from the same datasets as their training photos. Like the 99% PlantVillage figure, they are not real-farm accuracy. The earlier PlantVillage-only model scored 99.5% on lab photos but only 23.4% on PlantDoc field photos. The new crops have not yet been tested on independent photos.
- The 99% PlantVillage figure reflects clean lab photos and should not be read as real-world accuracy.

### Deployment

- **Model file:** `apps/inference/weights/disease_detect.onnx` (input 1×3×300×300, output raw logits for 52 classes, opset 17). The ONNX output matches PyTorch (max logit difference about 9e-6, same predictions) and gives the same accuracy through the backend's own preprocessing (PlantDoc 71.6%). On a 300-image tea sample, accuracy was 94.3% with the white padding left in and 94.0% with it trimmed, so the model does not depend on the padding.
- **Labels:** `disease_labels.json` lists the 52 classes. Indices 0-37 are the original classes in alphabetical order, followed by rice, tea and coconut.
- **Version:** `MODEL_VERSION = "disease-detect-efficientnet-b3-v3"`.
- **Treatment advice:** for the 38 original classes it comes from `TREATMENT_LOOKUP` in `disease_detect.py` (`_normalize` was rewritten so all 38 labels match; before, 11 classes returned empty advice). Advice for the 14 new classes is in `apps/inference/models/local_crop_treatments.py`, looked up by the exact label, because stripping the crop name would make "Coconut gray leaf spot" match the corn entry.

### Disease model limitations

- It only knows the 52 crop/disease classes in the training data. Crops like brinjal and chilli are not covered and will be forced into the nearest class.
- Blueberry, raspberry and soybean only have a "healthy" class, so the model cannot report a disease for them. Orange, squash, rice and coconut only have disease classes and no healthy class, so any leaf of those crops tends to be pushed toward one of their diseases.
- Coconut classes cover whole-tree symptoms (crown, stem and leaves), not only leaves. Only gray leaf spot and leaf rot are leaf diseases.
- Field-photo accuracy is much lower than lab accuracy. The model also confuses visually similar classes, such as the corn leaf diseases, tea gray blight and blister blight, and coconut leaf rot and gray leaf spot.
- The treatment text for rice, tea and coconut is a draft and still needs review by an agronomist. The entries for tea black blight and coconut bud root dropping need expert confirmation of the exact disease.
- The heatmap is an occlusion sensitivity map. It is an aid, not proof of what the model "looked at". It adds about 3 seconds on a CPU. Grad-CAM is not possible with the exported ONNX file.
- There is no plant-identification model yet.
- Results below 70% confidence are marked "needs expert review", shown as a possible match only, and their treatment advice is hidden.

### Next steps

- Collect local (Sri Lankan) farm photos and test rice, tea and coconut on them.
- Collect healthy rice and coconut leaf photos and add healthy classes.
- Add a `corrected_label` field so expert corrections can be used for retraining.
- Evaluate the models on independent field photos (per-class precision/recall, confusion matrix).
- Retrain with additional Roboflow Brown Plant Hopper data to improve discrimination among planthoppers.
- Have an agronomist review the treatment advice.

### Known fixes already applied in this build

- `bcrypt==4.0.1` pinned in `apps/api/requirements.txt` (newer bcrypt breaks passlib 1.7.4)
- `email-validator` added to `apps/api/requirements.txt` (required by Pydantic `EmailStr`)
- Landing page "Create an account" link fixed to `/register` (not `/(auth)/register`)
- `protected_namespaces = ()` set on schemas using a `model_version` field (removes Pydantic warning)
- `apps/web/public/` folder included (was missing, broke Docker web build)
- Disease label normalization fixed so all 38 original classes return treatment advice
- Treatment advice added for the rice, tea and coconut classes (`local_crop_treatments.py`)
- Pest detection model version updated to `pest-detect-yolov11s-v3` with 9 rice pest classes (`apps/inference/models/pest_detect.py`)
- Treatment, causes, and prevention guidance added for all 9 rice pests
- Gemini AI assistant added on the backend, with a per-user daily limit and a clear 503 when no key is set

## Security notes

- `SECRET_KEY` must be strong outside development. The API refuses to start otherwise.
- Passwords are hashed with bcrypt. Refresh tokens are stored as SHA-256 hashes, checked against a live session on every refresh, and revoked on logout.
- The inference service only downloads images from allowed hosts, does not follow redirects, and limits the download to 10 MB. Set `INFERENCE_API_KEY` for any shared or deployed setup.
- Uploads are checked by decoding the image, with limits on file size and dimensions. The browser's content type is not trusted.
- A diagnosis can only be attached to a field the user owns. History is private to each user.
- The Gemini key lives only in the API's environment. It is never sent to the browser and never committed. Photos are never sent to Gemini.
- Rate limiting is per user (or per IP when not logged in) and kept in memory for one process. Use a shared store such as Redis if you run several API processes.
- The local database file `agrisense.db` is no longer tracked, and `*.db` files are ignored. Keep any backup you made somewhere safe.

**Before a real deployment, also do the following:**

- Use strong, unique values for `SECRET_KEY`, `INFERENCE_API_KEY` and all database passwords. Do not use the Docker defaults.
- Serve everything over HTTPS and set `CORS_ORIGINS` to your real web address.
- Fix the frontend npm audit findings carefully. Test each upgrade, and do not run `npm audit fix --force` blindly.
- Protect uploaded photos with login. Today they are served from `/uploads/<user>/<random-name>`: the names cannot be guessed, but anyone with the link can open the photo.
- Move from the Gemini free tier to a paid plan if you have real users.
- Set up database backups and test a restore.

## Known limitations

- **Real-world accuracy is unknown.** The scores above are on the same datasets the models were trained on. Lab-photo accuracy is high and field-photo accuracy is much lower. Rice, tea, coconut and pests have not been tested on independent Sri Lankan farm photos.
- Pest detection is evaluated on the held-out IP102 test split only (115 images). It has not been benchmarked on independent farm photos.
- Plant identification does not exist yet.
- Treatment advice is a draft. It has not been reviewed by an agronomist.
- The disease model only knows its 52 classes. Other crops are forced into the nearest class (see the disease section for more).
- The AI assistant can be wrong and is limited by the free-tier quota.
- Frontend dependencies have known vulnerabilities that are not fixed yet.
- Uploaded photos are not login-protected.
- Assistant, outbreak map, review queue, farms and notifications have little or no automated test coverage.

## Roadmap

1. Check that CI is green on `main`, and fix anything it finds.
2. Fix the frontend dependency vulnerabilities.
3. Test disease and pest detection on labelled field photos, with per-class precision, recall and a confusion matrix.
4. Get an agronomist to review the treatment advice.
5. Add tests for the assistant, review queue, farms and notifications.
6. Train a plant identification model, or remove the feature from the demo.
7. Add healthy classes for rice and coconut, and a `corrected_label` field so expert corrections can be used for retraining.
8. Protect uploaded photos, and add frontend tests.
9. Add a LICENSE file. Check the IP102 academic-license terms before any commercial use.
10. Complete a production security review.

## Documentation

- [Database ERD](docs/)
- [ML architecture](docs/ml-architecture.md)
- [Disease model notes](docs/disease-model.md)
- Changelog
- `scripts/check_disease_model.py` checks the disease model file
- Interactive API docs: `/docs` on the running API

## Disclaimer

AgriSense AI is a decision-support tool. It does not replace advice from a qualified agriculture officer. The authors are not responsible for crop losses or harm that result from acting on its output.
