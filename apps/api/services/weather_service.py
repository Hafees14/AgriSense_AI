from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from apps.api.core.config import settings
from apps.api.models.farm import Farm
from apps.api.models.weather import WeatherCache

CACHE_TTL_MINUTES = 60


async def _fetch_from_provider(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,precipitation",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto",
    }
    async with httpx.AsyncClient(base_url=settings.WEATHER_API_BASE_URL, timeout=15.0) as client:
        response = await client.get("/forecast", params=params)
        response.raise_for_status()
        return response.json()


def _derive_risk_flags(daily: dict) -> tuple[str, str]:
    precipitation = daily.get("precipitation_sum", [0])
    max_temp = daily.get("temperature_2m_max", [0])
    disease_risk = "elevated" if any(p > 10 for p in precipitation[:3]) else "normal"
    water_stress = "high" if any(t > 34 for t in max_temp[:3]) else "normal"
    return disease_risk, water_stress


async def get_weather_for_farm(db: Session, farm: Farm) -> WeatherCache:
    cached = (
        db.query(WeatherCache)
        .filter(WeatherCache.farm_id == farm.id)
        .order_by(WeatherCache.fetched_at.desc())
        .first()
    )
    now = datetime.now(timezone.utc)
    if cached and cached.expires_at > now:
        return cached

    if farm.latitude is None or farm.longitude is None:
        raise ValueError("Farm has no coordinates set; cannot fetch weather.")

    raw = await _fetch_from_provider(float(farm.latitude), float(farm.longitude))
    disease_risk, water_stress = _derive_risk_flags(raw.get("daily", {}))

    entry = WeatherCache(
        farm_id=farm.id,
        fetched_at=now,
        current_json={**raw.get("current", {})},
        forecast_json={"daily": raw.get("daily", {}), "disease_risk": disease_risk, "water_stress": water_stress},
        expires_at=now + timedelta(minutes=CACHE_TTL_MINUTES),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
