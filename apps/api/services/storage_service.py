"""
Handles farmer image uploads.

Storage backend: local disk (apps/api/uploads/), served by FastAPI's
StaticFiles mount at /uploads/... — free, no external account or cloud
service needed. Works for local dev and small single-server deployments.
"""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from apps.api.core.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


async def validate_image(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image exceeds 10MB limit")
    return contents


def upload_diagnosis_image(contents: bytes, content_type: str, user_id: str) -> str:
    """Save an uploaded diagnosis image to local disk and return its public URL."""
    ext = "jpg" if content_type == "image/jpeg" else content_type.split("/")[-1]
    user_dir = UPLOAD_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4()}.{ext}"
    file_path = user_dir / filename
    file_path.write_bytes(contents)

    # Served by the StaticFiles mount in apps/api/main.py
    return f"{settings.API_PUBLIC_URL}/uploads/{user_id}/{filename}"
