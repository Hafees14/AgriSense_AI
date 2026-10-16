# Changelog

## Unreleased
- Added Gemini assistant: `POST /assistant/chat` with per-user and global daily limits (`apps/api/routers/assistant.py`, `services/gemini_assistant.py`, `core/assistant_limit.py`)
- Added `GEMINI_*` and `ASSISTANT_*` settings; `config.py` now also loads `apps/api/.env` by absolute path
- Pinned `httpx==0.28.1` and `pydantic==2.14.1` to match `google-genai`
- Run commands use `--reload-dir apps` (the old exclude pattern failed in PowerShell)

## Known fixes already applied in this build
- `bcrypt==4.0.1` pinned in apps/api/requirements.txt (newer bcrypt breaks passlib 1.7.4)
- `email-validator` added to apps/api/requirements.txt (required by Pydantic EmailStr)
- Landing page "Create an account" link fixed to `/register` (not `/(auth)/register`)
- `protected_namespaces = ()` set on schemas using a `model_version` field (removes Pydantic warning)
- `apps/web/public/` folder included (was missing, broke Docker web build)
- Disease label normalization fixed so all 38 original classes return treatment advice
- Treatment advice added for the rice, tea and coconut classes (`local_crop_treatments.py`)
- Pest detection model version updated to `pest-detect-yolov11s-v3` with 9 rice pest classes (`apps/inference/models/pest_detect.py`)
- Added treatment, causes, and prevention guidance for all 9 rice pests: Brown Plant Hopper, Rice Gall Midge, Rice Leaf Hopper, Rice Leaf Roller, Stem Borer, White Backed Plant Hopper, Small Brown Plant Hopper, Rice Water Weevil, and Rice Leaf Caterpillar


