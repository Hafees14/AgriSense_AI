"""Shared geo-distance helpers used anywhere we need "how far apart are
these two points" — outbreak alerts, the outbreak map, and anything else
that filters by radius. Kept in one place so the distance math (and any
future fix to it) isn't duplicated and doesn't drift between callers.
"""
import math

EARTH_RADIUS_KM = 6371.0


def bounding_box(lat: float, lon: float, radius_km: float) -> tuple[float, float, float, float]:
    """Cheap pre-filter box for a DB query. Not a true circle — longitude
    degrees shrink away from the equator — so always pair this with
    haversine_km() for the real distance check on the (much smaller)
    candidate set it returns.
    """
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / (111.0 * max(0.1, abs(math.cos(math.radians(lat)))))
    return lat - lat_delta, lat + lat_delta, lon - lon_delta, lon + lon_delta


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1_r, lon1_r, lat2_r, lon2_r = map(math.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))