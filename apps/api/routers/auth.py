from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from apps.api.core.config import settings
from apps.api.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from apps.api.core.deps import get_current_user
from apps.api.db.session import get_db
from apps.api.models.user import Role, User, UserSession
from apps.api.schemas.auth import (
    LanguageUpdateRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _utcnow() -> datetime:
    # The DB columns are timezone-naive, so keep everything naive UTC.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _issue_tokens(db: Session, user: User) -> TokenResponse:
    access_token = create_access_token(subject=user.id, extra_claims={"role": user.role.name})
    refresh_token = create_refresh_token(subject=user.id)

    db.add(
        UserSession(
            user_id=user.id,
            refresh_token_hash=hash_refresh_token(refresh_token),
            created_at=_utcnow(),
            expires_at=_utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    db.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(func.lower(User.email) == payload.email.lower()).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    if payload.role in ("officer", "researcher"):
        # Gate elevated-role signup behind a shared code rather than leaving
        # it open — these roles can review other farmers' diagnoses (see
        # require_role() in core/deps.py). No code configured means this
        # path is closed entirely, not silently allowed.
        if not settings.OFFICER_SIGNUP_CODE or payload.officer_code != settings.OFFICER_SIGNUP_CODE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing officer signup code.",
            )

    role = db.query(Role).filter(Role.name == payload.role).first()
    if role is None:
        role = Role(name=payload.role)
        db.add(role)
        db.flush()

    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        phone=payload.phone,
        role_id=role.id,
        language_pref=payload.language,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Two sign-ups with the same email at the same moment: the database unique rule wins.
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    db.refresh(user)

    return UserOut(id=user.id, name=user.name, email=user.email, role=role.name, language_pref=user.language_pref)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    return _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if claims.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    # The token must also match a live, un-revoked session we issued.
    session = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == claims["sub"],
            UserSession.refresh_token_hash == hash_refresh_token(payload.refresh_token),
            UserSession.revoked.is_(False),
            UserSession.expires_at > _utcnow(),
        )
        .first()
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.")

    user = db.query(User).filter(User.id == claims["sub"]).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Same session keeps working (no rotation), so several browser tabs
    # refreshing at once cannot log each other out.
    access_token = create_access_token(subject=user.id, extra_claims={"role": user.role.name})
    return TokenResponse(access_token=access_token, refresh_token=payload.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Revoke the session behind a refresh token. Always 204, so it cannot be used to probe tokens."""
    db.query(UserSession).filter(UserSession.refresh_token_hash == hash_refresh_token(payload.refresh_token)).update(
        {"revoked": True}
    )
    db.commit()


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, name=user.name, email=user.email, role=user.role.name, language_pref=user.language_pref)


@router.patch("/me/language", response_model=UserOut)
def update_language(
    payload: LanguageUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.language_pref = payload.language
    db.commit()
    db.refresh(user)
    return UserOut(id=user.id, name=user.name, email=user.email, role=user.role.name, language_pref=user.language_pref)