import io

import httpx
import numpy as np
from PIL import Image

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406])
IMAGENET_STD = np.array([0.229, 0.224, 0.225])


async def download_image(image_url: str) -> Image.Image:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(image_url)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert("RGB")


def preprocess_for_classification(image: Image.Image, target_size: int = 300) -> np.ndarray:
    resized = image.resize((target_size, target_size), Image.BILINEAR)
    array = np.asarray(resized).astype(np.float32) / 255.0
    array = (array - IMAGENET_MEAN) / IMAGENET_STD
    array = array.transpose(2, 0, 1)[np.newaxis, ...].astype(np.float32)
    return array


def preprocess_for_detection(image: Image.Image, target_size: int = 640) -> np.ndarray:
    resized = image.resize((target_size, target_size), Image.BILINEAR)
    array = np.asarray(resized).astype(np.float32) / 255.0
    array = array.transpose(2, 0, 1)[np.newaxis, ...].astype(np.float32)
    return array
