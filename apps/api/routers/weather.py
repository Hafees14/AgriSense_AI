from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from apps.api.core.deps import get_current_user
from apps.api.db.session import get_db
from apps.api.models.farm import Farm
from apps.api.models.user import User
from apps.api.schemas.misc import WeatherOut
from apps.api.services.weather_service import get_weather_for_farm

router = APIRouter(tags=["weather"])


@router.get("/weather", response_model=WeatherOut)
async def get_weather(farm_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == user.id).first()
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    try:
        cache_entry = await get_weather_for_farm(db, farm)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return WeatherOut(
        farm_id=farm.id,
        current=cache_entry.current_json,
        forecast=cache_entry.forecast_json.get("daily", {}).get("time", []) and [cache_entry.forecast_json],
        disease_risk=cache_entry.forecast_json.get("disease_risk"),
        water_stress=cache_entry.forecast_json.get("water_stress"),
        fetched_at=cache_entry.fetched_at,
    )
