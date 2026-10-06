from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.doctor_review import DoctorReview
from app.models.prediction import Prediction
from app.models.scan import Scan


def top_prediction(prediction: Prediction | None) -> dict | None:
    if prediction is None:
        return None
    probabilities = {
        "Normal": float(prediction.normal_probability),
        "Pneumonia": float(prediction.pneumonia_probability),
        "Tuberculosis": float(prediction.tuberculosis_probability),
        "Other": float(prediction.other_probability),
    }
    label = max(probabilities, key=probabilities.get)
    return {"class": label, "probability": probabilities[label]}


def patient_scan_history(db: Session, patient_id: UUID, exclude_scan_id: UUID | None = None) -> list[dict]:
    scan_query = select(Scan).where(Scan.patient_id == patient_id)
    if exclude_scan_id is not None:
        scan_query = scan_query.where(Scan.id != exclude_scan_id)
    scans = db.scalars(scan_query.order_by(Scan.created_at.desc(), Scan.id.desc())).all()
    if not scans:
        return []

    scan_ids = [scan.id for scan in scans]
    predictions = {
        item.scan_id: item
        for item in db.scalars(select(Prediction).where(Prediction.scan_id.in_(scan_ids))).all()
    }
    reviews = {
        item.scan_id: item
        for item in db.scalars(select(DoctorReview).where(DoctorReview.scan_id.in_(scan_ids))).all()
    }
    return [
        {
            "scan_id": scan.id,
            "created_at": scan.created_at,
            "quality_score": scan.quality_score,
            "quality_status": scan.quality_status.value,
            "top_prediction": top_prediction(predictions.get(scan.id)),
            "doctor_review_status": reviews[scan.id].status.upper() if scan.id in reviews else "NOT_REQUESTED",
        }
        for scan in scans
    ]


def patient_probability_trend(db: Session, patient_id: UUID) -> list[dict]:
    rows = db.execute(
        select(
            Scan.created_at,
            Prediction.pneumonia_probability,
            Prediction.tuberculosis_probability,
        )
        .join(Prediction, Prediction.scan_id == Scan.id)
        .where(Scan.patient_id == patient_id)
        .order_by(Scan.created_at.asc(), Scan.id.asc())
    ).all()
    return [
        {
            "date": scan_date,
            "pneumonia_probability": float(pneumonia_probability),
            "tuberculosis_probability": float(tuberculosis_probability),
        }
        for scan_date, pneumonia_probability, tuberculosis_probability in rows
    ]
