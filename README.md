# AgriSense AI

AI-powered agricultural decision support platform. Monorepo: Next.js frontend,
FastAPI core backend (MySQL), separate AI inference microservice.

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

## Known fixes already applied in this build
- `bcrypt==4.0.1` pinned in apps/api/requirements.txt (newer bcrypt breaks passlib 1.7.4)
- `email-validator` added to apps/api/requirements.txt (required by Pydantic EmailStr)
- Landing page "Create an account" link fixed to `/register` (not `/(auth)/register`)
- `protected_namespaces = ()` set on schemas using a `model_version` field (removes Pydantic warning)
- `apps/web/public/` folder included (was missing, broke Docker web build)

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
