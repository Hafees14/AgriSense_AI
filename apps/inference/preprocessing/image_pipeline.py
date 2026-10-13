import io
import os
from urllib.parse import urlparse

import httpx
import numpy as np
from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406])
IMAGENET_STD = np.array([0.229, 0.224, 0.225])

MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 50_000_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def _allowed_hosts() -> set[str]:
    raw = os.getenv("INFERENCE_ALLOWED_IMAGE_HOSTS", "localhost,127.0.0.1,api")
    return {h.strip().lower() for h in raw.split(",") if h.strip()}


def check_image_url(image_url: str) -> None:
    """Only fetch images from our own API host. Anything else could be used to make this
    service call internal addresses on an attacker's behalf (SSRF)."""
    parsed = urlparse(image_url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid image URL")
    if parsed.hostname.lower() not in _allowed_hosts():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Image host is not allowed")


def decode_image(data: bytes) -> Image.Image:
    """Turn raw bytes into an RGB image, or raise a clean 422 for corrupt/unsupported files."""
    try:
        img = Image.open(io.BytesIO(data))
        img.load()  # forces a full decode so truncated files fail here, not later
        return img.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not read the image")


async def download_image(image_url: str) -> Image.Image:
    check_image_url(image_url)
    try:
        # follow_redirects=False: a redirect could point at a host we did not allow.
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
            async with client.stream("GET", image_url) as response:
                response.raise_for_status()
                chunks, total = [], 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > MAX_DOWNLOAD_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image is too large"
                        )
                    chunks.append(chunk)
    except httpx.HTTPError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not fetch the image")
    return decode_image(b"".join(chunks))


def preprocess_for_classification(image: Image.Image, target_size: int = 300) -> np.ndarray:
    resized = image.resize((target_size, target_size), Image.BILINEAR)
    array = np.asarray(resized).astype(np.float32) / 255.0
    array = (array - IMAGENET_MEAN) / IMAGENET_STD
    array = array.transpose(2, 0, 1)[np.newaxis, ...].astype(np.float32)
    return array


def letterbox(image: Image.Image, target_size: int = 640) -> tuple[np.ndarray, float, tuple[float, float]]:
    """Resize keeping the aspect ratio and pad with grey (114), the way YOLO models are trained.

    Returns (tensor [1,3,S,S], scale, (pad_x, pad_y)) so boxes can be mapped back to the original image.
    """
    w, h = image.size
    scale = min(target_size / w, target_size / h)
    new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
    resized = image.resize((new_w, new_h), Image.BILINEAR)
    canvas = Image.new("RGB", (target_size, target_size), (114, 114, 114))
    pad_x, pad_y = (target_size - new_w) / 2, (target_size - new_h) / 2
    canvas.paste(resized, (int(round(pad_x - 0.1)), int(round(pad_y - 0.1))))
    array = np.asarray(canvas).astype(np.float32) / 255.0
    return array.transpose(2, 0, 1)[np.newaxis, ...].astype(np.float32), scale, (pad_x, pad_y)


def preprocess_for_detection(image: Image.Image, target_size: int = 640) -> np.ndarray:
    return letterbox(image, target_size)[0]
