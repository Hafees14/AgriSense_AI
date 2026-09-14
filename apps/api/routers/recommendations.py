from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from apps.api.core.deps import get_current_user
from apps.api.db.session import get_db
from apps.api.models.farm import Farm
from apps.api.models.recommendation import Recommendation
from apps.api.models.user import User
from apps.api.schemas.misc import RecommendationOut
from apps.api.services.recommendation_engine import generate_recommendations

router = APIRouter(tags=["recommendations"])


@router.get("/recommendations", response_model=list[RecommendationOut])
def list_recommendations(farm_id: str, refresh: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == user.id).first()
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    if refresh:
        generate_recommendations(db, farm)

    return (
        db.query(Recommendation)
        .filter(Recommendation.farm_id == farm_id)
        .order_by(Recommendation.created_at.desc())
        .limit(20)
        .all()
    )
