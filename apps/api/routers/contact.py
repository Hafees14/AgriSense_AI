from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from apps.api.core.rate_limit import rate_limit
from apps.api.db.session import get_db
from apps.api.models.contact import ContactMessage
from apps.api.schemas.misc import ContactMessageCreate, ContactMessageOut

router = APIRouter(tags=["contact"])


@router.post(
    "/contact",
    response_model=ContactMessageOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(5))],
)
def submit_contact_message(payload: ContactMessageCreate, db: Session = Depends(get_db)):
    # Public endpoint (no get_current_user) — a visitor doesn't need an
    # account to reach the team. Rate-limited by IP via rate_limit()'s
    # existing fallback to keep it from being used as a spam relay.
    entry = ContactMessage(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry