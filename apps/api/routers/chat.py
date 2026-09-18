import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from apps.api.core.deps import get_current_user
from apps.api.core.rate_limit import rate_limit
from apps.api.core.config import settings
from apps.api.db.session import get_db
from apps.api.models.chat import ChatMessage
from apps.api.models.user import User
from apps.api.schemas.misc import ChatMessageOut, ChatRequest, ChatResponse
from apps.api.services import context_service
from apps.api.services.llm_service import LLMConfigError, generate_assistant_reply

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(rate_limit(settings.RATE_LIMIT_PER_MINUTE))])
async def send_chat_message(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message cannot be empty.")

    session_id = payload.session_id or str(uuid.uuid4())

    # Load prior turns in this session so the assistant has conversation
    # context, not just the new message in isolation.
    history_rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    history = [(row.role, row.message) for row in history_rows]

    # Farm-aware context (farm, latest diagnosis, current weather risk) —
    # without this the assistant has no idea what farm/crop it's talking
    # about. Best-effort: any failure here just means a plainer answer,
    # never a broken chat request.
    try:
        context = await context_service.get_farm_context_for_user(db, user.id)
        context_block = context_service.format_context_block(context)
    except Exception:
        context_block = ""

    try:
        reply_text, follow_ups = await generate_assistant_reply(
            history=history,
            new_message=message,
            context_block=context_block,
            language=user.language_pref or "en",
        )
    except LLMConfigError as exc:
        # A clean, actionable 503 instead of a raw 500/timeout — the
        # frontend turns this into a friendly "AI assistant is
        # unavailable" message rather than a blank screen.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI assistant is temporarily unavailable. Please try again shortly.",
        ) from exc

    db.add(ChatMessage(user_id=user.id, session_id=session_id, role="user", message=message))
    db.add(ChatMessage(user_id=user.id, session_id=session_id, role="assistant", message=reply_text))
    db.commit()

    return ChatResponse(session_id=session_id, reply=reply_text, follow_up_questions=follow_ups)


@router.get("/chat/history", response_model=list[ChatMessageOut])
def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )