import math

from sqlalchemy.orm import Session

from apps.api.models.diagnosis import Diagnosis
from apps.api.models.farm import Farm
from apps.api.models.notification import Notification

# A single diagnosis at or above this confidence is treated as reliable
# enough, on its own, to warn nearby farmers — no need to wait for multiple
# independent reports of the same problem.
CONFIDENCE_THRESHOLD = 0.90
OUTBREAK_RADIUS_KM = 100.0
EARTH_RADIUS_KM = 6371.0


def _bounding_box(lat: float, lon: float, radius_km: float) -> tuple[float, float, float, float]:
    """Cheap pre-filter box passed to the DB query, refined afterwards with
    a real haversine distance check. A pure lat/lon box gets meaningfully
    inaccurate at 100 km (it's not a circle, and longitude degrees shrink
    away from the equator), so it's only used to cut down the candidate
    set before the precise check below.
    """
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / (111.0 * max(0.1, abs(math.cos(math.radians(lat)))))
    return lat - lat_delta, lat + lat_delta, lon - lon_delta, lon + lon_delta


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1_r, lon1_r, lat2_r, lon2_r = map(math.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def check_and_raise_outbreak_alert(db: Session, new_diagnosis: Diagnosis) -> Notification | None:
    if new_diagnosis.diagnosis_type not in ("disease", "pest"):
        return None
    if new_diagnosis.confidence_score is None or float(new_diagnosis.confidence_score) < CONFIDENCE_THRESHOLD:
        return None
    if new_diagnosis.latitude is None or new_diagnosis.longitude is None:
        # Can't target anyone by location without the reporting farmer's
        # own coordinates — silently skip rather than notify everyone.
        return None

    origin_lat = float(new_diagnosis.latitude)
    origin_lon = float(new_diagnosis.longitude)

    lat_min, lat_max, lon_min, lon_max = _bounding_box(origin_lat, origin_lon, OUTBREAK_RADIUS_KM)

    candidate_farms = (
        db.query(Farm)
        .filter(
            Farm.user_id != new_diagnosis.user_id,
            Farm.latitude.isnot(None),
            Farm.longitude.isnot(None),
            Farm.latitude.between(lat_min, lat_max),
            Farm.longitude.between(lon_min, lon_max),
        )
        .all()
    )

    recipient_user_ids: set[str] = set()
    for farm in candidate_farms:
        distance_km = _haversine_km(origin_lat, origin_lon, float(farm.latitude), float(farm.longitude))
        if distance_km <= OUTBREAK_RADIUS_KM:
            recipient_user_ids.add(farm.user_id)

    if not recipient_user_ids:
        return None

    kind_label = "Disease" if new_diagnosis.diagnosis_type == "disease" else "Pest"
    confidence_pct = float(new_diagnosis.confidence_score) * 100
    alert_body = (
        f"A high-confidence report of {new_diagnosis.result_label} "
        f"({confidence_pct:.0f}% confidence) was logged within {OUTBREAK_RADIUS_KM:.0f} km "
        "of your farm. Inspect your crops and consider preventive treatment."
    )

    last_notification: Notification | None = None
    for user_id in recipient_user_ids:
        notif = Notification(
            user_id=user_id,
            title=f"{kind_label} Alert: {new_diagnosis.result_label}",
            body=alert_body,
            type="outbreak_alert",
        )
        db.add(notif)
        last_notification = notif

    db.commit()
    return last_notification