from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.dependencies.auth import require_role
from app.models.doctor_review import DoctorReview
from app.models.model_version import ModelVersion
from app.models.notification import Notification
from app.models.prediction import Prediction
from app.models.scan import Scan
from app.models.user import User
from app.schemas.reviews import ReviewSubmission
from app.services.screening_history import patient_scan_history, top_prediction

patient_router = APIRouter(prefix="/scans", tags=["doctor reviews"])
doctor_router = APIRouter(prefix="/doctor/reviews", tags=["doctor reviews"])


def _review_or_404(db: Session, review_id: UUID) -> DoctorReview:
    review = db.get(DoctorReview, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review request not found")
    return review


def _prediction_and_version(db: Session, scan_id: UUID) -> tuple[Prediction | None, ModelVersion | None]:
    prediction = db.scalar(select(Prediction).where(Prediction.scan_id == scan_id))
    if prediction is None:
        return None, None
    return prediction, db.get(ModelVersion, prediction.model_version_id)


def _prediction_payload(prediction: Prediction | None, version: ModelVersion | None) -> dict | None:
    if prediction is None:
        return None
    return {
        "normal_probability": prediction.normal_probability,
        "pneumonia_probability": prediction.pneumonia_probability,
        "tuberculosis_probability": prediction.tuberculosis_probability,
        "other_probability": prediction.other_probability,
        "ai_confidence": prediction.ai_confidence,
        "model_version": version.version if version else None,
    }


@patient_router.post("/{scan_id}/request-review", status_code=201)
def request_review(
    scan_id: UUID,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role("patient")),
):
    scan = db.get(Scan, scan_id)
    if scan is None or scan.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="Scan not found")
    if db.scalar(select(Prediction.id).where(Prediction.scan_id == scan.id)) is None:
        raise HTTPException(status_code=409, detail="AI analysis must be completed before requesting doctor verification")
    if db.scalar(select(DoctorReview.id).where(DoctorReview.scan_id == scan.id)) is not None:
        raise HTTPException(status_code=409, detail="Doctor verification has already been requested for this scan")

    review = DoctorReview(scan_id=scan.id, requested_by=patient.id)
    scan.doctor_review_status = "pending"
    db.add(review)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        original = exc.orig
        diagnostic = getattr(original, "diag", None)
        constraint = getattr(diagnostic, "constraint_name", None)
        if constraint == "uq_doctor_reviews_scan_id":
            raise HTTPException(status_code=409, detail="Doctor verification has already been requested for this scan") from exc
        raise
    db.refresh(review)
    return {
        "id": review.id,
        "scan_id": review.scan_id,
        "status": review.status.upper(),
        "requested_at": review.requested_at,
    }


@doctor_router.get("")
def list_reviews(
    status: Literal["pending", "completed"] = "pending",
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role("doctor")),
):
    reviews = db.scalars(
        select(DoctorReview).where(DoctorReview.status == status).order_by(DoctorReview.requested_at.desc())
    ).all()
    result = []
    for review in reviews:
        scan = db.get(Scan, review.scan_id)
        patient = db.get(User, review.requested_by)
        if scan is None or patient is None:
            continue
        prediction, _ = _prediction_and_version(db, scan.id)
        finding = top_prediction(prediction)
        result.append({
            "id": review.id,
            "status": review.status.upper(),
            "requested_at": review.requested_at,
            "patient_id": patient.id,
            "patient_name": patient.full_name,
            "scan_id": scan.id,
            "top_prediction": finding["class"] if finding else None,
            "top_probability": finding["probability"] if finding else None,
            "ai_confidence": prediction.ai_confidence if prediction else None,
        })
    return result


@doctor_router.get("/{review_id}")
def get_review_detail(
    review_id: UUID,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role("doctor")),
):
    review = _review_or_404(db, review_id)
    scan = db.get(Scan, review.scan_id)
    patient = db.get(User, review.requested_by)
    if scan is None or patient is None:
        raise HTTPException(status_code=404, detail="Review data not found")
    prediction, version = _prediction_and_version(db, scan.id)
    doctor_user = db.get(User, review.reviewed_by) if review.reviewed_by else None
    return {
        "id": review.id,
        "status": review.status.upper(),
        "decision": review.decision,
        "notes": review.notes,
        "requested_at": review.requested_at,
        "reviewed_at": review.reviewed_at,
        "reviewed_by": doctor_user.full_name if doctor_user else None,
        "patient": {"id": patient.id, "full_name": patient.full_name, "email": patient.email},
        "scan": {
            "id": scan.id,
            "created_at": scan.created_at,
            "quality_score": scan.quality_score,
            "quality_status": scan.quality_status.value,
            "quality_issues": scan.quality_issues,
            "user_continued_anyway": scan.user_continued_anyway,
            "prediction": _prediction_payload(prediction, version),
        },
        "images": {
            "original": f"/doctor/reviews/{review.id}/images/original",
            "gradcam": f"/doctor/reviews/{review.id}/images/gradcam" if prediction else None,
        },
        "previous_scans": patient_scan_history(db, patient.id, exclude_scan_id=scan.id),
    }


@doctor_router.get("/{review_id}/images/{image_kind}")
def get_review_image(
    review_id: UUID,
    image_kind: Literal["original", "gradcam"],
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role("doctor")),
):
    review = _review_or_404(db, review_id)
    scan = db.get(Scan, review.scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    if image_kind == "original":
        image_path = Path(scan.storage_path)
    else:
        prediction = db.scalar(select(Prediction).where(Prediction.scan_id == scan.id))
        if prediction is None:
            raise HTTPException(status_code=404, detail="Grad-CAM image not available")
        image_path = Path(prediction.gradcam_path)
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="Image file not found")
    return FileResponse(image_path, media_type="image/png")


@doctor_router.post("/{review_id}/submit")
def submit_review(
    review_id: UUID,
    payload: ReviewSubmission,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role("doctor")),
):
    review = db.scalar(select(DoctorReview).where(DoctorReview.id == review_id).with_for_update())
    if review is None:
        raise HTTPException(status_code=404, detail="Review request not found")
    if review.status == "completed":
        raise HTTPException(status_code=409, detail="This review has already been completed")
    review.status = "completed"
    review.decision = payload.decision.value
    review.notes = payload.notes.strip() if payload.notes and payload.notes.strip() else None
    review.reviewed_at = datetime.now(timezone.utc)
    review.reviewed_by = doctor.id
    scan = db.get(Scan, review.scan_id)
    if scan is not None:
        scan.doctor_review_status = "completed"
    db.add(Notification(
        user_id=review.requested_by,
        scan_id=review.scan_id,
        message="Your X-ray review has been completed by the doctor.",
    ))
    db.commit()
    db.refresh(review)
    return {
        "id": review.id,
        "status": review.status.upper(),
        "decision": review.decision,
        "notes": review.notes,
        "reviewed_at": review.reviewed_at,
        "reviewed_by": doctor.full_name,
    }
