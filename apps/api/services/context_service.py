"""
Builds a short, factual context string about a farmer's situation
(farm, latest diagnosis, current weather/disease risk) so it can be
injected into the LLM system prompt or attached to a diagnosis response.

This is the "farm-aware AI" piece — without it, the chat assistant and
the diagnosis endpoint both give generic, farm-agnostic answers.
"""

from sqlalchemy.orm import Session

from apps.api.models.diagnosis import Diagnosis
from apps.api.models.farm import Farm
from apps.api.services import weather_service


async def get_farm_context_for_user(db: Session, user_id: str) -> dict:
    """
    Returns a dict with whatever we know about the user's situation right now:
      - farm: Farm | None (most recently created farm, if any)
      - latest_diagnosis: Diagnosis | None
      - weather: WeatherCache | None (only fetched if farm has coordinates)
    Never raises — any missing piece is just None, so callers can build a
    partial context instead of failing the whole request.
    """
    farm = (
        db.query(Farm)
        .filter(Farm.user_id == user_id)
        .order_by(Farm.created_at.desc())
        .first()
    )

    latest_diagnosis = (
        db.query(Diagnosis)
        .filter(Diagnosis.user_id == user_id)
        .order_by(Diagnosis.created_at.desc())
        .first()
    )

    weather = None
    if farm is not None and farm.latitude is not None and farm.longitude is not None:
        try:
            weather = await weather_service.get_weather_for_farm(db, farm)
        except Exception:
            # Weather is a nice-to-have for context — never let a provider
            # hiccup break chat or diagnosis.
            weather = None

    return {"farm": farm, "latest_diagnosis": latest_diagnosis, "weather": weather}


def format_context_block(context: dict) -> str:
    """
    Turns the dict from get_farm_context_for_user() into a short plain-text
    block to append to the LLM system prompt. Returns "" if there's nothing
    to say (new user, no farm yet) so the prompt doesn't get a hollow section.
    """
    farm = context.get("farm")
    diagnosis = context.get("latest_diagnosis")
    weather = context.get("weather")

    if not farm and not diagnosis:
        return ""

    lines = ["\nCURRENT FARMER CONTEXT (use this to personalize your answer; do not repeat it verbatim):"]

    if farm:
        parts = [f"Farm: {farm.name}"]
        if farm.region:
            parts.append(f"region {farm.region}")
        if farm.land_size_ha:
            parts.append(f"{farm.land_size_ha} ha")
        lines.append("- " + ", ".join(parts))

    if diagnosis:
        lines.append(
            f"- Most recent diagnosis: {diagnosis.diagnosis_type} = \"{diagnosis.result_label}\" "
            f"(confidence {float(diagnosis.confidence_score):.0%}, severity {diagnosis.severity or 'unknown'})"
        )

    if weather is not None:
        forecast = weather.forecast_json or {}
        disease_risk = forecast.get("disease_risk", "unknown")
        water_stress = forecast.get("water_stress", "unknown")
        lines.append(f"- Current weather-derived risk: disease risk {disease_risk}, water stress {water_stress}")

    return "\n".join(lines)


def build_weather_advisory(weather) -> str | None:
    """
    Turns a WeatherCache row into a one-line advisory string for a
    diagnosis response. Returns None if there's no weather to report.
    """
    if weather is None:
        return None
    forecast = weather.forecast_json or {}
    disease_risk = forecast.get("disease_risk")
    water_stress = forecast.get("water_stress")
    if not disease_risk and not water_stress:
        return None

    pieces = []
    if disease_risk == "elevated":
        pieces.append("Rain in the next 3 days raises disease risk — consider preventive treatment now rather than waiting.")
    if water_stress == "high":
        pieces.append("High temperatures forecast — watch for water stress and irrigate accordingly.")
    if not pieces:
        pieces.append("No elevated weather risk detected for this farm right now.")
    return " ".join(pieces)