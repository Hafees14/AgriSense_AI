from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from apps.api.models.diagnosis import Diagnosis
from apps.api.models.farm import Farm, Field as FieldModel
from apps.api.models.recommendation import Recommendation
from apps.api.models.weather import WeatherCache


@dataclass
class FarmContext:
    farm: Farm
    fields: list[FieldModel]
    recent_diagnoses: list[Diagnosis]
    weather: WeatherCache | None
    sensor: dict | None = field(default=None)


def _build_farm_context(db: Session, farm: Farm) -> FarmContext:
    fields = db.query(FieldModel).filter(FieldModel.farm_id == farm.id).all()

    window_start = datetime.now(timezone.utc) - timedelta(days=30)
    recent_diagnoses = (
        db.query(Diagnosis)
        .join(FieldModel, Diagnosis.field_id == FieldModel.id, isouter=True)
        .filter(FieldModel.farm_id == farm.id, Diagnosis.created_at >= window_start)
        .all()
    )

    weather = (
        db.query(WeatherCache)
        .filter(WeatherCache.farm_id == farm.id)
        .order_by(WeatherCache.fetched_at.desc())
        .first()
    )

    return FarmContext(farm=farm, fields=fields, recent_diagnoses=recent_diagnoses, weather=weather)


def _rule_irrigation(context: FarmContext) -> Recommendation | None:
    if context.weather is None:
        return None
    forecast = context.weather.forecast_json.get("daily", [])
    upcoming_rain = any(day.get("precipitation_mm", 0) > 5 for day in forecast[:2])
    if upcoming_rain:
        return Recommendation(
            farm_id=context.farm.id,
            type="irrigation",
            content="Rain expected within 48 hours — consider delaying irrigation to avoid waterlogging.",
            source="rule_engine",
            valid_until=datetime.now(timezone.utc) + timedelta(days=2),
        )
    return None


def _rule_disease_risk(context: FarmContext) -> Recommendation | None:
    disease_events = [d for d in context.recent_diagnoses if d.diagnosis_type == "disease"]
    if len(disease_events) >= 2:
        return Recommendation(
            farm_id=context.farm.id,
            type="disease_risk",
            content=(
                f"{len(disease_events)} disease diagnoses recorded on this farm in the last 30 days. "
                "Consider a preventive fungicide/organic treatment cycle and closer monitoring."
            ),
            source="rule_engine",
            valid_until=datetime.now(timezone.utc) + timedelta(days=14),
        )
    return None


def _rule_sensor_soil_moisture(context: FarmContext) -> Recommendation | None:
    if not context.sensor:
        return None
    moisture = context.sensor.get("soil_moisture_pct")
    if moisture is not None and moisture < 20:
        return Recommendation(
            farm_id=context.farm.id,
            type="irrigation",
            content=f"Soil moisture reading is low ({moisture}%). Irrigation recommended within 24 hours.",
            source="rule_engine",
            valid_until=datetime.now(timezone.utc) + timedelta(days=1),
        )
    return None


RULES = [_rule_irrigation, _rule_disease_risk, _rule_sensor_soil_moisture]


def generate_recommendations(db: Session, farm: Farm) -> list[Recommendation]:
    context = _build_farm_context(db, farm)
    new_recommendations = []
    for rule in RULES:
        result = rule(context)
        if result is not None:
            db.add(result)
            new_recommendations.append(result)

    if new_recommendations:
        db.commit()
        for rec in new_recommendations:
            db.refresh(rec)

    return new_recommendations
