from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from apps.api.core.deps import require_role
from apps.api.db.session import get_db
from apps.api.models.diagnosis import Diagnosis
from apps.api.models.user import Role, User
from apps.api.schemas.diagnosis import ExpertReviewRequest, OfficerSummaryOut, RegionSummary, ReviewQueueItem
from apps.api.services.geo_utils import haversine_km

router = APIRouter(prefix="/reviews", tags=["reviews"])

# Only accounts registered with the "officer" role can see or act on the
# review queue — this is what makes the "Verified by an officer" badge
# meaningful rather than something any farmer could set on their own
# diagnosis.
_require_officer = require_role("officer")

UNKNOWN_REGION = "Unspecified"


@router.get("/queue", response_model=list[ReviewQueueItem])
def get_review_queue(db: Session = Depends(get_db), officer: User = Depends(_require_officer)):
    diagnoses = (
        db.query(Diagnosis)
        .filter(Diagnosis.needs_expert_review.is_(True), Diagnosis.expert_reviewed.is_(False))
        .order_by(Diagnosis.created_at.asc())
        .all()
    )
    return [
        ReviewQueueItem(
            id=d.id,
            diagnosis_type=d.diagnosis_type,
            result_label=d.result_label,
            confidence_score=float(d.confidence_score),
            severity=d.severity,
            image_url=d.image_url,
            farmer_name=d.user.name,
            created_at=d.created_at,
        )
        for d in diagnoses
    ]


@router.get("/summary", response_model=OfficerSummaryOut)
def get_officer_summary(
    days: int = Query(30, gt=0, le=180),
    db: Session = Depends(get_db),
    officer: User = Depends(_require_officer),
) -> OfficerSummaryOut:
    window_start = datetime.now(timezone.utc) - timedelta(days=days)

    # Diagnosis has no region of its own — a farmer's region lives on their
    # Farm. Resolve each diagnosis to a region by finding its owner's
    # nearest farm-with-a-region to where the photo was taken (falling
    # back to their first farm with a region set if no coordinates are
    # available on either side). Loaded eagerly to avoid an N+1 query per
    # diagnosis.
    diagnoses = (
        db.query(Diagnosis)
        .options(joinedload(Diagnosis.user).joinedload(User.farms))
        .filter(
            Diagnosis.diagnosis_type.in_(("disease", "pest")),
            Diagnosis.created_at >= window_start,
        )
        .all()
    )

    region_buckets: dict[str, dict] = {}
    for d in diagnoses:
        region = _resolve_region(d)
        bucket = region_buckets.setdefault(
            region,
            {
                "diagnosis_count": 0,
                "disease_count": 0,
                "pest_count": 0,
                "high_severity_count": 0,
                "needs_review_count": 0,
                "labels": Counter(),
            },
        )
        bucket["diagnosis_count"] += 1
        bucket["disease_count" if d.diagnosis_type == "disease" else "pest_count"] += 1
        if d.severity in ("high", "critical"):
            bucket["high_severity_count"] += 1
        if d.needs_expert_review and not d.expert_reviewed:
            bucket["needs_review_count"] += 1
        bucket["labels"][d.result_label] += 1

    regions = [
        RegionSummary(
            region=region,
            diagnosis_count=b["diagnosis_count"],
            disease_count=b["disease_count"],
            pest_count=b["pest_count"],
            high_severity_count=b["high_severity_count"],
            needs_review_count=b["needs_review_count"],
            top_issue=b["labels"].most_common(1)[0][0] if b["labels"] else None,
        )
        for region, b in region_buckets.items()
    ]
    regions.sort(key=lambda r: r.diagnosis_count, reverse=True)

    # Pending review reflects the current queue regardless of the summary
    # window — a diagnosis from 40 days ago still waiting is still pending.
    pending_review_count = (
        db.query(Diagnosis)
        .filter(Diagnosis.needs_expert_review.is_(True), Diagnosis.expert_reviewed.is_(False))
        .count()
    )
    # NOTE: Diagnosis doesn't currently record *which* officer reviewed it
    # (no reviewer_id column), so this is reviews completed by anyone in
    # the window, not specifically by this officer. Adding per-officer
    # attribution would need a small schema migration.
    reviewed_in_window_count = (
        db.query(Diagnosis)
        .filter(Diagnosis.expert_reviewed.is_(True), Diagnosis.updated_at >= window_start)
        .count()
    )
    total_farmers = db.query(User).join(User.role).filter(Role.name == "farmer").count()

    return OfficerSummaryOut(
        window_days=days,
        generated_at=datetime.now(timezone.utc),
        pending_review_count=pending_review_count,
        reviewed_in_window_count=reviewed_in_window_count,
        total_farmers=total_farmers,
        regions=regions,
    )


def _resolve_region(diagnosis: Diagnosis) -> str:
    farms_with_region = [f for f in diagnosis.user.farms if f.region]
    if not farms_with_region:
        return UNKNOWN_REGION

    if diagnosis.latitude is not None and diagnosis.longitude is not None:
        farms_with_coords = [f for f in farms_with_region if f.latitude is not None and f.longitude is not None]
        if farms_with_coords:
            nearest = min(
                farms_with_coords,
                key=lambda f: haversine_km(
                    float(diagnosis.latitude), float(diagnosis.longitude), float(f.latitude), float(f.longitude)
                ),
            )
            return nearest.region

    return farms_with_region[0].region


@router.patch("/{diagnosis_id}", status_code=status.HTTP_204_NO_CONTENT)
def submit_review(
    diagnosis_id: str,
    payload: ExpertReviewRequest,
    db: Session = Depends(get_db),
    officer: User = Depends(_require_officer),
):
    diagnosis = db.query(Diagnosis).filter(Diagnosis.id == diagnosis_id).first()
    if diagnosis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnosis not found")

    diagnosis.expert_reviewed = True
    diagnosis.expert_notes = payload.expert_notes
    db.commit()