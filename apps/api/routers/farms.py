from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from apps.api.core.deps import get_current_user
from apps.api.db.session import get_db
from apps.api.models.farm import Farm, Field
from apps.api.models.user import User
from apps.api.schemas.farm import FarmCreate, FarmOut, FarmUpdate, FieldCreate, FieldOut

router = APIRouter(prefix="/farms", tags=["farms"])


def _get_owned_farm(db: Session, farm_id: str, user: User) -> Farm:
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == user.id).first()
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    return farm


@router.post("", response_model=FarmOut, status_code=status.HTTP_201_CREATED)
def create_farm(payload: FarmCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    farm = Farm(user_id=user.id, **payload.model_dump())
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return farm


@router.get("", response_model=list[FarmOut])
def list_farms(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Farm).filter(Farm.user_id == user.id).order_by(Farm.created_at.desc()).all()


@router.get("/{farm_id}", response_model=FarmOut)
def get_farm(farm_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_owned_farm(db, farm_id, user)


@router.patch("/{farm_id}", response_model=FarmOut)
def update_farm(
    farm_id: str, payload: FarmUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    farm = _get_owned_farm(db, farm_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(farm, field, value)
    db.commit()
    db.refresh(farm)
    return farm


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_farm(farm_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    farm = _get_owned_farm(db, farm_id, user)
    db.delete(farm)
    db.commit()


@router.post("/{farm_id}/fields", response_model=FieldOut, status_code=status.HTTP_201_CREATED)
def create_field(
    farm_id: str, payload: FieldCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    _get_owned_farm(db, farm_id, user)
    new_field = Field(farm_id=farm_id, **payload.model_dump())
    db.add(new_field)
    db.commit()
    db.refresh(new_field)
    return new_field


@router.get("/{farm_id}/fields", response_model=list[FieldOut])
def list_fields(farm_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _get_owned_farm(db, farm_id, user)
    return db.query(Field).filter(Field.farm_id == farm_id).all()
