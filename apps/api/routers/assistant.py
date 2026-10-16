"""Gemini assistant router.  Save as: apps/api/routers/assistant.py

Endpoint: POST /assistant/chat  (login required)
"""
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from google.genai import errors as genai_errors
from pydantic import BaseModel, Field

from apps.api.core.assistant_limit import check_daily_limit, refund_call
from apps.api.services.gemini_assistant import ask_gemini

# --- VERIFY THESE THREE IMPORTS against your project (see the grep commands) ---
from apps.api.core.deps import get_current_user, get_db      # where your other routers import them from
from apps.api.db.session import get_db
from apps.api.models import Diagnosis                         # your Diagnosis model
# ------------------------------------------------------------------------------

logger = logging.getLogger("agrisense.assistant")

router = APIRouter(prefix="/assistant", tags=["assistant"])

LOW_CONFIDENCE = 0.70  # same 70% rule the app uses for "needs expert review"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class AssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=10)
    language: Literal["en", "si", "ta"] = "en"
    diagnosis_id: int | None = None


class AssistantResponse(BaseModel):
    reply: str


def _diagnosis_summary(d) -> str:
    """Short text about a diagnosis. Text only: no image, no user details."""
    label = getattr(d, "label", None) or getattr(d, "disease_name", None) or "unknown"
    conf = float(getattr(d, "confidence", 0) or 0)
    if conf > 1:  # stored as 0-100 instead of 0-1
        conf = conf / 100
    text = f"{label}, confidence {conf:.0%}"
    if conf < LOW_CONFIDENCE:
        text += " (below 70%, unconfirmed: do not give treatment advice)"
    return text


@router.post("/chat", response_model=AssistantResponse)
async def chat(
    req: AssistantRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    # 1. Look up the diagnosis first, so a wrong id does not use up the user's quota.
    summary = None
    if req.diagnosis_id is not None:
        d = db.get(Diagnosis, req.diagnosis_id)
        if not d or d.user_id != user.id:  # ownership check: never reveal other users' data
            raise HTTPException(404, "Diagnosis not found")
        summary = _diagnosis_summary(d)

    # 2. Daily limits (per user and for the whole shared key). Raises 429.
    check_daily_limit(user.id)

    # 3. Call Gemini. Give the quota back if Google fails.
    try:
        reply = await ask_gemini(
            req.message,
            [m.model_dump() for m in req.history],
            req.language,
            summary,
        )
    except RuntimeError:
        refund_call(user.id)
        raise HTTPException(503, "Assistant is not configured")
    except genai_errors.APIError as e:
        refund_call(user.id)
        logger.warning("Gemini API error %s", getattr(e, "code", "?"))
        if getattr(e, "code", None) == 429:
            raise HTTPException(429, "Assistant is busy. Try again in a minute.")
        raise HTTPException(502, "Assistant service error")

    if not reply.strip():
        refund_call(user.id)
        raise HTTPException(502, "The assistant returned an empty answer. Please try again.")

    return AssistantResponse(reply=reply)