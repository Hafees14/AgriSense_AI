"""
Handles farmer image uploads.

Storage backend: local disk (apps/api/uploads/), served by FastAPI's
StaticFiles mount at /uploads/... — free, no external account or cloud
service needed. Works for local dev and small single-server deployments.
"""
import io
import uuid
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from fastapi import HTTPException, UploadFile, status

from apps.api.core.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# What we accept, keyed by the format Pillow detects from the file bytes.
FORMAT_TO_CONTENT_TYPE = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_IMAGE_PIXELS = 50_000_000  # blocks "decompression bomb" images
MIN_IMAGE_SIDE = 32


def detect_content_type(contents: bytes) -> str:
    """Check the bytes really are a JPEG/PNG/WebP picture and return the true content type.

    The browser-supplied Content-Type header can be anything, so it is not trusted.
    """
    try:
        with Image.open(io.BytesIO(contents)) as img:
            fmt = img.format
            width, height = img.size
            img.verify()  # detects truncated / corrupted files
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The file is not a valid image. Please upload a JPEG, PNG or WebP photo.",
        )
    if fmt not in FORMAT_TO_CONTENT_TYPE:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {fmt}",
        )
    if width * height > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image dimensions are too large")
    if min(width, height) < MIN_IMAGE_SIDE:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Image is too small to analyse")
    return FORMAT_TO_CONTENT_TYPE[fmt]


async def validate_image(file: UploadFile) -> bytes:
    """Read an upload with a hard size cap and verify it is a real image. Returns the bytes."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )
    # Read one byte past the limit so an oversized file is rejected without loading all of it.
    contents = await file.read(MAX_FILE_SIZE_BYTES + 1)
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image exceeds 10MB limit")
    if not contents:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The uploaded file is empty")
    detect_content_type(contents)
    return contents


def delete_stored_image(image_url: str) -> None:
    """Remove a file we saved earlier (used when the analysis fails, so no orphan files pile up)."""
    prefix = f"{settings.API_PUBLIC_URL}/uploads/"
    if not image_url.startswith(prefix):
        return
    target = (UPLOAD_DIR / image_url[len(prefix):]).resolve()
    if UPLOAD_DIR.resolve() in target.parents and target.is_file():
        target.unlink(missing_ok=True)


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


def upload_heatmap_image(contents: bytes, user_id: str) -> str:
    """Save the explanation overlay (PNG) next to the diagnosis photo and return its URL."""
    user_dir = UPLOAD_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}-heatmap.png"
    (user_dir / filename).write_bytes(contents)
    return f"{settings.API_PUBLIC_URL}/uploads/{user_id}/{filename}"


def upload_farm_image(contents: bytes, content_type: str, user_id: str, farm_id: str) -> str:
    """Save a farm photo to local disk and return its public URL. Reuses
    the same validated-upload mechanism and StaticFiles mount as diagnosis
    images rather than a second storage path — just a different subfolder
    so the two are easy to tell apart on disk."""
    ext = "jpg" if content_type == "image/jpeg" else content_type.split("/")[-1]
    farm_dir = UPLOAD_DIR / "farms" / user_id
    farm_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{farm_id}.{ext}"
    file_path = farm_dir / filename
    file_path.write_bytes(contents)

    return f"{settings.API_PUBLIC_URL}/uploads/farms/{user_id}/{filename}"