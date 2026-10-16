# AgriSense AI

[![CI](https://github.com/Hafees14/AgriSense_AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Hafees14/AgriSense_AI/actions/workflows/ci.yml)

AgriSense AI helps farmers find out what is wrong with a crop. The farmer takes
a photo of a leaf or pest, and the app suggests the likely disease or pest, says
how sure it is, and gives advice on treatment and prevention. A built-in AI
assistant (Google Gemini) answers follow-up questions in English, Sinhala and
Tamil. Built by team TIMESWARE for the AgriTech Startup Spark 2026 competition.

> **A prediction is not a diagnosis.** The results come from machine-learning
> models trained mostly on lab photos. When the model is not sure (below 70%
> confidence), the app says so, shows the result only as a "possible match", and
> hides the treatment advice. The treatment text is a draft that an agronomist
> has not reviewed yet. The AI assistant can also make mistakes. Always check
> with a local agriculture officer before spraying anything.

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
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Disclaimer](#disclaimer)

## What the app does

- **Disease detection:** upload a leaf photo, get a disease name, a confidence
  score, severity, causes, organic and chemical treatment, and prevention tips.
- **Pest detection:** bounding boxes, counts, causes, treatment and prevention
  tips for nine common rice pests.
- **Explanation heatmap:** shows which parts of the leaf affected the result most.
- **AI assistant:** a chat that answers farming questions and can explain a
  saved diagnosis. Powered by the Gemini API (free tier is enough for a demo).
- **Expert review:** low-confidence results go to a queue for agriculture officers.
- **History:** every successful diagnosis is saved for the user.
- **Also:** farms and fields, weather, recommendations, outbreak map, notifications.
- **Three languages:** English, Sinhala and Tamil.
- **Weak connection support:** photos taken offline are queued and sent later.

## Current status

| Feature                                                   | Status                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Register, login, refresh, logout, protected routes        | Working. Covered by automated tests                                                             |
| Disease detection (EfficientNet-B3, 52 classes)           | Working end to end with the real model                                                          |
| Pest detection (YOLOv11s, 9 rice pests)                   | Working (mAP50 0.787, mAP50-95 0.441 on 115 test images)                                        |
| Explanation heatmap                                       | Working as an occlusion sensitivity map (not Grad-CAM)                                          |
| AI assistant (Gemini)                                     | Needs `GEMINI_API_KEY`. Without a key the chat returns a clear 503 and the rest of the app works |
| Plant identification                                      | **Not available.** No trained model. The API answers 503 and the app shows "Coming soon"        |
| History, farms, fields, notifications, outbreak map       | Implemented. Only history has automated API tests                                               |
| Database                                                  | MySQL for real use. SQLite for a quick local try. Migrations run in CI against MySQL            |
| Docker Compose                                            | Builds and starts on the team's machines. CI also builds the images                             |
| Frontend dependency audit                                 | `npm audit` reported 13 issues (1 critical, 10 high, 2 moderate). **Not fixed yet**             |
| Accuracy on real farm photos                              | **Not measured yet**                                                                            |

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
    farms)          ▼
              ONNX models: disease, pest
```

1. The web app sends the photo to the core API.
2. The API checks the image, saves it, and asks the inference service to analyse it.
3. The inference service fetches the image, runs the ONNX model, and returns the
   label, confidence, advice and (for diseases) a heatmap.
4. The API stores the result and returns it to the web app.
5. For chat, the web app sends text to the core API. The API adds a safety
   prompt and the diagnosis summary, calls Gemini, and returns the answer.
   The browser never sees the Gemini key, and photos are never sent to Gemini.

If the inference service is down, or its model files are missing, the API
returns a clear 503 error and saves nothing.

**Technology:** Next.js 14 and TypeScript, Tailwind CSS, FastAPI, SQLAlchemy and
Alembic, MySQL 8, ONNX Runtime, Google Gemini API (`google-genai`), Docker
Compose, GitHub Actions.

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

The `.onnx` model files are stored with **Git LFS**. A normal clone gives you
small pointer files (about 133 bytes) instead of the models. The inference
service then reports `degraded`, and the API refuses to return results. Run:

```
git lfs install
git lfs pull
```

Then open `http://localhost:8001/health` once the inference service is running.
`"status": "ok"` means the disease and pest models are loaded. Plant
identification shows `loaded: false`, which is expected.

> GitHub's free Git LFS plan has a monthly bandwidth limit. If `git lfs pull`
> fails with a quota error, download the weights from the team's shared drive
> and place them in `apps/inference/weights/`.

## Quick start with Docker

Needs Docker and Git LFS.

```
git lfs pull
cp apps/api/.env.example apps/api/.env       # set SECRET_KEY, GEMINI_API_KEY
cd infra
cp .env.example .env                         # set the passwords in infra/.env
docker compose up --build
```

| Service                           | Address                                         |
| --------------------------------- | ----------------------------------------------- |
| Web app                           | <http://localhost:3000>                         |
| API (interactive docs at `/docs`) | <http://localhost:8002>                         |
| Inference service (health)        | <http://localhost:8001/health> (localhost only) |

The inference image refuses to build if the model files are still LFS pointers.
Uploaded photos and the database are kept in Docker volumes.

On Windows, Docker Desktop with WSL2 can be slow or unstable on weak
connections. The local setup below is a good alternative.

## Run locally without Docker

You need Python 3.12, Node 20 and Git LFS. MySQL is optional.

### 1. Database

**Quick try:** skip this step. If neither `DB_HOST` nor `DATABASE_URL` is set,
the API uses a local SQLite file.

**MySQL (recommended for anything real):**

```sql
CREATE DATABASE agrisense_db;
CREATE USER 'agrisense'@'%' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON agrisense_db.* TO 'agrisense'@'%';
FLUSH PRIVILEGES;
```

Copy `apps/api/.env.example` to `apps/api/.env`, set `DB_PASSWORD` to match, and
set `SECRET_KEY` to a random value:

```
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Core API (terminal 1, from the repo root)

```
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1      Mac/Linux: source .venv/bin/activate
pip install -r apps/api/requirements.txt
alembic -c apps/api/alembic.ini upgrade head
python -m apps.api.db.seed
uvicorn apps.api.main:app --reload --reload-dir apps
```

Check: <http://localhost:8000/docs>

### 3. Inference service (terminal 2, from the repo root)

```
pip install -r apps/inference/requirements.txt
uvicorn apps.inference.main:app --reload --reload-dir apps --port 8001
```

Check: <http://localhost:8001/health>

### 4. Web app (terminal 3)

```
cd apps/web
npm install
cp .env.example .env.local        # Windows: copy .env.example .env.local
npm run dev
```

Open <http://localhost:3000>

## Configuration

Never commit real secrets. `.env` files are ignored by git.

**Core API (`apps/api/.env`)**

| Variable                                                  | Meaning                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ENV`                                                     | `development` (default) or `production`. Outside development the API will not start with a weak `SECRET_KEY` |
| `SECRET_KEY`                                              | Signs login tokens. Must be at least 32 random characters outside development                                |
| `DATABASE_URL`                                            | Full database URL. If empty: MySQL is built from `DB_*` when `DB_HOST` is set, otherwise SQLite              |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection                                                                                             |
| `INFERENCE_SERVICE_URL`                                   | Where the inference service is (default `http://localhost:8001`)                                             |
| `INFERENCE_API_KEY`                                       | Shared secret sent to the inference service. Set the same value on both                                      |
| `API_PUBLIC_URL`                                          | Public address of the API. Used to build photo links                                                         |
| `INTERNAL_API_URL`                                        | Docker only. How the inference container reaches the API. Leave empty otherwise                              |
| `CORS_ORIGINS`                                            | Allowed web origins, as a JSON list                                                                          |
| `GEMINI_API_KEY`                                          | Key from <https://aistudio.google.com/apikey>. Empty means the assistant is switched off                     |
| `GEMINI_MODEL`                                            | Gemini model name. Check AI Studio for the free models available to your key                                |
| `ASSISTANT_DAILY_LIMIT`                                   | Max assistant messages per user per day (default 30)                                                         |
| `DEBUG`                                                   | `true` prints SQL to the log. Keep it `false`                                                                |

**Inference service (environment variables)**

| Variable                        | Meaning                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `INFERENCE_API_KEY`             | If set, every request must send it in the `X-Inference-Key` header             |
| `INFERENCE_ALLOWED_IMAGE_HOSTS` | Hosts the service may download images from (default `localhost,127.0.0.1,api`) |

**Web app (`apps/web/.env.local`)**

| Variable                   | Meaning                                        |
| -------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Address of the core API as the browser sees it |

**Docker (`infra/.env`)**

| Variable              | Meaning                                                 |
| --------------------- | ------------------------------------------------------- |
| `MYSQL_ROOT_PASSWORD` | Required                                                |
| `MYSQL_PASSWORD`      | Password for the app's database user                    |
| `INFERENCE_API_KEY`   | Shared secret between the API and the inference service |

## AI assistant (Gemini)

The assistant runs **only on the backend**. The web app calls
`POST /assistant/chat` on the core API, and the API calls Gemini.

**Get a free key**

1. Open <https://aistudio.google.com/apikey> and sign in with a Google account.
2. Create an API key and put it in `apps/api/.env` as `GEMINI_API_KEY`.
3. Restart the API.

**Behaviour**

- Text only. Leaf photos are never sent to Gemini.
- The system prompt tells the model to answer only about farming, to reply in
  the user's language, to avoid exact pesticide doses, and to point to a local
  agriculture officer for anything serious.
- If a diagnosis is attached and its confidence is below 70%, the assistant is
  told to treat it as unconfirmed and not to give treatment advice.
- The free tier has low per-minute and per-day limits shared by all users of
  the key. When Google returns 429, the API answers 429 with a friendly message.
  `ASSISTANT_DAILY_LIMIT` caps each user so one person cannot use the whole quota.
- Google may use free-tier prompts to improve its products. Do not send names,
  phone numbers or exact farm locations in chat.

**Quick test**

```
curl -X POST http://localhost:8000/assistant/chat \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I prevent rice blast?", "language": "en"}'
```

## Tests

```
pip install -r apps/api/requirements-dev.txt -r apps/inference/requirements.txt
python -m pytest tests -q
```

The tests cover login and sessions, image upload checks, ownership rules,
inference error handling, the image-fetch guard, pest box decoding, and real
inference. Four tests run the real models and are skipped if the weights are
still LFS pointers. Tests use a temporary SQLite database and do not touch your
data. Gemini calls are mocked, so tests need no API key.

Frontend checks:

```
cd apps/web
npm run typecheck
npm run lint
npm run build
```

There are no automated frontend tests yet.

## Machine learning models

The inference service loads ONNX models from `apps/inference/weights/`. If a
model's weights are missing or are Git LFS pointers, its wrapper returns a stub
response (confidence 0.0, model version ending in `-stub`). The core API
rejects stub results with a 503, so a fake result is never shown or saved.

| Task                 | Model                                                              | Status                                                                              |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Disease detection    | EfficientNet-B3, 52 classes (17 crops), 300×300 input              | Trained: `disease-detect-efficientnet-b3-v3`                                        |
| Pest detection       | YOLOv11s (Ultralytics ONNX export), 9 rice pests, 640×640 input    | Trained: `pest-detect-yolov11s-v3` (mAP50 0.787, mAP50-95 0.441 on 115 test images) |
| Plant identification | EfficientNet-B3                                                    | No trained model. The feature is turned off                                         |

**Disease model accuracy on held-out test images**

| Test set                           | Images | Accuracy |
| ---------------------------------- | ------ | -------- |
| PlantVillage (lab photos)          | 5,459  | 99.2%    |
| PlantDoc (field photos)            | 236    | 71.6%    |
| Rice                               | 385    | 99.5%    |
| Tea                                | 538    | 94.2%    |
| Coconut                            | 1,137  | 98.8%    |

These scores come from the same datasets the models were trained on. They are
**not** real-farm accuracy. An earlier PlantVillage-only model scored 99.5% on
lab photos but only 23.4% on PlantDoc field photos. The PlantDoc, rice and
coconut sets are small or may contain near-duplicates, so treat those numbers as
rough (about ±5 to ±10 points).

**Supported rice pests (9):** Brown Plant Hopper, Rice Gall Midge, Rice Leaf
Hopper, Rice Leaf Roller, Stem Borer, White Backed Plant Hopper, Small Brown
Plant Hopper, Rice Water Weevil, Rice Leaf Caterpillar.

**Heatmap:** for disease results with at least 50% confidence the service hides
parts of the leaf one at a time and measures how much the confidence drops. It
is an occlusion sensitivity map, not Grad-CAM, because an exported ONNX model
has no gradients. It takes about 3 seconds on a CPU.

Datasets, training steps, per-class notes and deployment details are in
[`docs/disease-model.md`](docs/disease-model.md) and
[`docs/ml-architecture.md`](docs/ml-architecture.md).

## Security notes

- `SECRET_KEY` must be strong outside development. The API refuses to start otherwise.
- Passwords are hashed with bcrypt. Refresh tokens are stored as SHA-256
  hashes, checked against a live session on every refresh, and revoked on logout.
- The inference service only downloads images from allowed hosts, does not
  follow redirects, and limits the download to 10 MB. Set `INFERENCE_API_KEY`
  for any shared or deployed setup.
- Uploads are checked by decoding the image, with limits on file size and
  dimensions. The browser's content type is not trusted.
- A diagnosis can only be attached to a field the user owns. History is private to each user.
- The Gemini key lives only in the API's environment. It is never sent to the
  browser and never committed.
- Rate limiting is per user (or per IP when not logged in) and kept in memory
  for one process. Use a shared store such as Redis if you run several API processes.
- `*.db` files are ignored by git. Keep any backup somewhere safe.

**Before a real deployment**

- Use strong, unique values for `SECRET_KEY`, `INFERENCE_API_KEY` and all
  database passwords. Do not use the Docker defaults.
- Serve everything over HTTPS and set `CORS_ORIGINS` to your real web address.
- Fix the frontend `npm audit` findings carefully. Test each upgrade, and do not
  run `npm audit fix --force` blindly.
- Protect uploaded photos with login. Today anyone with the link can open a photo.
- Move from the Gemini free tier to a paid plan if you have real users.
- Set up database backups and test a restore.

## Known limitations

- **Real-world accuracy is unknown.** Rice, tea, coconut and pests have not been
  tested on independent Sri Lankan farm photos.
- **The disease model only knows its 52 classes.** Other crops (for example
  brinjal and chilli) are forced into the nearest class. Blueberry, raspberry
  and soybean have only a "healthy" class. Orange, squash, rice and coconut have
  only disease classes.
- **Treatment advice is a draft** and has not been reviewed by an agronomist.
- **The AI assistant can be wrong** and is limited by the free-tier quota.
- Plant identification does not exist yet.
- Frontend dependencies have known vulnerabilities that are not fixed yet.
- Uploaded photos are not login-protected.
- Assistant, outbreak map, review queue, farms and notifications have little or
  no automated test coverage.

## Roadmap

1. Check that CI is green on `main`, and fix anything it finds.
2. Fix the frontend dependency vulnerabilities.
3. Test disease and pest detection on labelled field photos, with per-class
   precision, recall and a confusion matrix.
4. Get an agronomist to review the treatment advice.
5. Add tests for the assistant, review queue, farms and notifications.
6. Train a plant identification model, or remove the feature from the demo.
7. Add healthy classes for rice and coconut, and a `corrected_label` field so
   expert corrections can be used for retraining.
8. Protect uploaded photos, and add frontend tests.
9. Add a `LICENSE` file. Check the IP102 academic-license terms before any commercial use.
10. Complete a production security review.

## Documentation

- [Database ERD](docs/database-erd.md)
- [ML architecture](docs/ml-architecture.md)
- [Disease model notes](docs/disease-model.md)
- [Changelog](CHANGELOG.md)
- `scripts/check_disease_model.py` checks the disease model file
- Interactive API docs: `/docs` on the running API

## Disclaimer

AgriSense AI is a decision-support tool. It does not replace advice from a
qualified agriculture officer. The authors are not responsible for crop losses
or harm that result from acting on its output.
