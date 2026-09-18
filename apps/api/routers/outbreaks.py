from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from apps.api.core.deps import get_current_user
from apps.api.db.session import get_db
from apps.api.models.diagnosis import Diagnosis
from apps.api.models.farm import Farm
from apps.api.models.user import User
from apps.api.schemas.misc import OutbreakHotspot, OutbreakMapOut
from apps.api.services.geo_utils import bounding_box, haversine_km

router = APIRouter(prefix="/outbreaks", tags=["outbreaks"])

# Reports are clustered onto a rounded coordinate grid before being
# returned, and counted per distinct farmer — the map never exposes any
# individual farmer's exact location, identity, or raw report count.
GRID_PRECISION = 2  # ~1.1 km grid cells at the equator
MIN_CONFIDENCE_FOR_MAP = 0.60
DEFAULT_WINDOW_DAYS = 30
DEFAULT_RADIUS_KM = 100.0


@router.get("", response_model=OutbreakMapOut)
def get_outbreak_map(
    farm_id: str | None = Query(None, description="Center the map on one of your farms."),
    latitude: float | None = Query(None, description="Center latitude, if not using farm_id."),
    longitude: float | None = Query(None, description="Center longitude, if not using farm_id."),
    radius_km: float = Query(DEFAULT_RADIUS_KM, gt=0, le=500),
    days: int = Query(DEFAULT_WINDOW_DAYS, gt=0, le=180),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OutbreakMapOut:
    if farm_id:
        farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == user.id).first()
        if farm is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
        if farm.latitude is None or farm.longitude is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This farm has no location set")
        center_lat, center_lon = float(farm.latitude), float(farm.longitude)
    elif latitude is not None and longitude is not None:
        center_lat, center_lon = latitude, longitude
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide farm_id, or both latitude and longitude.",
        )

    lat_min, lat_max, lon_min, lon_max = bounding_box(center_lat, center_lon, radius_km)
    window_start = datetime.now(timezone.utc) - timedelta(days=days)

    reports = (
        db.query(Diagnosis)
        .filter(
            Diagnosis.diagnosis_type.in_(("disease", "pest")),
            Diagnosis.confidence_score >= MIN_CONFIDENCE_FOR_MAP,
            Diagnosis.created_at >= window_start,
            Diagnosis.latitude.isnot(None),
            Diagnosis.longitude.isnot(None),
            Diagnosis.latitude.between(lat_min, lat_max),
            Diagnosis.longitude.between(lon_min, lon_max),
        )
        .all()
    )

    # Cluster into rounded grid cells per (type, label) — this is what
    # keeps individual farmers anonymous: the map only ever returns a
    # cell centroid and a distinct-reporter count, never a raw coordinate
    # or a user id.
    clusters: dict[tuple, dict] = {}
    for report in reports:
        lat, lon = float(report.latitude), float(report.longitude)
        distance_km = haversine_km(center_lat, center_lon, lat, lon)
        if distance_km > radius_km:
            continue

        cell_key = (
            report.diagnosis_type,
            report.result_label,
            round(lat, GRID_PRECISION),
            round(lon, GRID_PRECISION),
        )
        cluster = clusters.setdefault(
            cell_key,
            {
                "diagnosis_type": report.diagnosis_type,
                "label": report.result_label,
                "severity": report.severity,
                "lat_sum": 0.0,
                "lon_sum": 0.0,
                "point_count": 0,
                "reporter_ids": set(),
                "last_reported_at": report.created_at,
            },
        )
        cluster["lat_sum"] += lat
        cluster["lon_sum"] += lon
        cluster["point_count"] += 1
        cluster["reporter_ids"].add(report.user_id)
        if report.created_at > cluster["last_reported_at"]:
            cluster["last_reported_at"] = report.created_at
            cluster["severity"] = report.severity  # reflect the most recent report's severity

    hotspots = []
    for cluster in clusters.values():
        centroid_lat = cluster["lat_sum"] / cluster["point_count"]
        centroid_lon = cluster["lon_sum"] / cluster["point_count"]
        hotspots.append(
            OutbreakHotspot(
                diagnosis_type=cluster["diagnosis_type"],
                label=cluster["label"],
                severity=cluster["severity"],
                report_count=len(cluster["reporter_ids"]),
                latitude=round(centroid_lat, GRID_PRECISION),
                longitude=round(centroid_lon, GRID_PRECISION),
                distance_km=round(haversine_km(center_lat, center_lon, centroid_lat, centroid_lon), 1),
                last_reported_at=cluster["last_reported_at"],
            )
        )

    hotspots.sort(key=lambda h: h.last_reported_at, reverse=True)

    return OutbreakMapOut(
        center_latitude=center_lat,
        center_longitude=center_lon,
        radius_km=radius_km,
        generated_at=datetime.now(timezone.utc),
        hotspots=hotspots,
    )