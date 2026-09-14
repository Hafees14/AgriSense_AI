import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from apps.api.core.deps import get_current_user
from apps.api.db.session import get_db
from apps.api.models.chat import ChatMessage
from apps.api.models.user import User
from apps.api.schemas.misc import ChatMessageOut, ChatRequest, ChatResponse
from apps.api.services import context_service
from apps.api.services.llm_service import LLMConfigError, generate_assistant_reply

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session_id = payload.session_id or str(uuid.uuid4())

    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    db.add(ChatMessage(user_id=user.id, session_id=session_id, role="user", message=payload.message))
    db.commit()

    farm_context = await context_service.get_farm_context_for_user(db, user.id)
    context_block = context_service.format_context_block(farm_context)

    try:
        reply, follow_ups = await generate_assistant_reply(
            history=[(m.role, m.message) for m in history],
            new_message=payload.message,
            context_block=context_block,
        )
    except LLMConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    db.add(ChatMessage(user_id=user.id, session_id=session_id, role="assistant", message=reply))
    db.commit()

    return ChatResponse(session_id=session_id, reply=reply, follow_up_questions=follow_ups)


@router.get("/chat/history", response_model=list[ChatMessageOut])
def chat_history(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )