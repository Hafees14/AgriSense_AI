from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from apps.api.core.deps import require_role
from apps.api.db.session import get_db
from apps.api.models.diagnosis import Diagnosis
from apps.api.models.user import User
from apps.api.schemas.diagnosis import ExpertReviewRequest, ReviewQueueItem

router = APIRouter(prefix="/reviews", tags=["reviews"])

# Only accounts registered with the "officer" role can see or act on the
# review queue — this is what makes the "Verified by an officer" badge
# meaningful rather than something any farmer could set on their own
# diagnosis.
_require_officer = require_role("officer")


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