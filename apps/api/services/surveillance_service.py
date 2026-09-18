import math

from sqlalchemy.orm import Session

from apps.api.models.diagnosis import Diagnosis
from apps.api.models.farm import Farm
from apps.api.models.notification import Notification
from apps.api.services.geo_utils import bounding_box, haversine_km

# A single diagnosis at or above this confidence is treated as reliable
# enough, on its own, to warn nearby farmers — no need to wait for multiple
# independent reports of the same problem.
CONFIDENCE_THRESHOLD = 0.90
OUTBREAK_RADIUS_KM = 100.0


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

    lat_min, lat_max, lon_min, lon_max = bounding_box(origin_lat, origin_lon, OUTBREAK_RADIUS_KM)

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
        distance_km = haversine_km(origin_lat, origin_lon, float(farm.latitude), float(farm.longitude))
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