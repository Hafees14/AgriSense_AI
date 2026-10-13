"""Access control for the inference service."""
import hmac
import os

from fastapi import Header, HTTPException, status


def require_inference_key(x_inference_key: str | None = Header(default=None)) -> None:
    """If INFERENCE_API_KEY is set, every analysis request must send it in X-Inference-Key.

    When the variable is empty (local development) no key is needed.
    """
    expected = os.getenv("INFERENCE_API_KEY", "")
    if not expected:
        return
    if x_inference_key is None or not hmac.compare_digest(x_inference_key, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid inference key")
