"""Shared test setup. Environment variables are set BEFORE the app is imported, so the
tests always use a throw-away SQLite database and never touch real data."""
import io
import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="agrisense-tests-"))
os.environ["ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP / 'test.db'}"
os.environ["DEBUG"] = "false"
os.environ["INFERENCE_API_KEY"] = ""
os.environ.pop("DB_HOST", None)

import pytest  # noqa: E402
from PIL import Image  # noqa: E402


def make_image_bytes(fmt: str = "PNG", size=(96, 96), colour=(40, 140, 60)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, colour).save(buf, format=fmt)
    return buf.getvalue()


@pytest.fixture(scope="session")
def image_bytes() -> bytes:
    return make_image_bytes()
