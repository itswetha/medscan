from pathlib import Path
import shutil
from uuid import UUID

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.storage import UnsafeStoragePath, resolve_upload_file
from app.db.session import get_db
from app.dependencies.auth import require_role
from app.models.doctor_review import DoctorReview
from app.models.model_version import ModelVersion
from app.models.prediction import Prediction
from app.models.scan import Scan, ScanQualityStatus
from app.models.user import User
from app.services.image_quality import check_image_quality
from app.ml.inference_service import run_analysis
from app.services.scan_report import build_scan_report
from app.services.screening_history import patient_scan_history
from app.services.audit import add_audit_log

router = APIRouter(prefix="/scans", tags=["scans"])
patients_router = APIRouter(prefix="/patients", tags=["patients"])
MAX_FILE_SIZE = 10 * 1024 * 1024


def _decode_image(data: bytes, filename: str | None) -> np.ndarray:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png"}:
        raise HTTPException(status_code=415, detail="Only JPEG and PNG images are accepted")
    if not (data.startswith(b"\xff\xd8\xff") or data.startswith(b"\x89PNG\r\n\x1a\n")):
        raise HTTPException(status_code=415, detail="Uploaded file is not a valid JPEG or PNG image")
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Image could not be decoded")
    return image


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_scan(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    patient: User = Depends(require_role("patient")),
):
    data = await file.read(MAX_FILE_SIZE + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")
    if len(data) >= MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Image must be smaller than 10 MB")
    image = _decode_image(data, file.filename)
    quality = check_image_quality(image)

    scan = Scan(patient_id=patient.id, original_filename=Path(file.filename or "xray.png").name[:255], storage_path="pending", quality_score=quality["quality_score"], quality_status=ScanQualityStatus(quality["quality_status"]), quality_issues=quality["quality_issues"])
    db.add(scan)
    db.flush()
    scan_dir = Path(settings.upload_dir) / str(scan.id)
    scan_dir.mkdir(parents=True, exist_ok=True)
    encoded_ok, encoded = cv2.imencode(".png", image)
    if not encoded_ok:
        db.rollback()
        scan_dir.rmdir()
        raise HTTPException(status_code=500, detail="Could not save uploaded image")
    image_path = scan_dir / "original.png"
    scan.storage_path = str(image_path)
    try:
        image_path.write_bytes(encoded.tobytes())
        scan.storage_path = str(image_path)
        add_audit_log(db, patient.id, "scan_upload", f"scans/{scan.id}")
        db.commit()
    except Exception:
        db.rollback()
        image_path.unlink(missing_ok=True)
        scan_dir.rmdir()
        raise
    return {"scan_id": scan.id, **quality}


@router.post("/{scan_id}/continue-anyway", status_code=status.HTTP_200_OK)
def continue_anyway(scan_id: UUID, db: Session = Depends(get_db), patient: User = Depends(require_role("patient"))):
    scan = db.get(Scan, scan_id)
    if scan is None or scan.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="Scan not found")
    if scan.quality_status != ScanQualityStatus.poor:
        raise HTTPException(status_code=400, detail="Continue anyway is only available for poor-quality scans")
    scan.user_continued_anyway = True
    db.commit()
    return {"scan_id": scan.id, "user_continued_anyway": True}


def _prediction_response(prediction: Prediction, model_version: ModelVersion) -> dict:
    return {
        "normal_probability": prediction.normal_probability,
        "pneumonia_probability": prediction.pneumonia_probability,
        "tuberculosis_probability": prediction.tuberculosis_probability,
        "other_probability": prediction.other_probability,
        "ai_confidence": prediction.ai_confidence,
        "gradcam_path": prediction.gradcam_path,
        "model_version": model_version.version,
    }



@patients_router.get("/{patient_id}/scans")
def list_patient_scans(
    patient_id: UUID,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role("patient")),
):
    # Patients can access only their own longitudinal screening history.
    if patient.id != patient_id:
        raise HTTPException(status_code=404, detail="Patient not found")

    return patient_scan_history(db, patient_id)


@router.get("/{scan_id}/report.pdf")
def download_scan_report(
    scan_id: UUID,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role("patient")),
):
    scan = db.get(Scan, scan_id)
    if scan is None or scan.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="Scan not found")
    prediction = db.scalar(select(Prediction).where(Prediction.scan_id == scan.id))
    if prediction is None:
        raise HTTPException(status_code=409, detail="Report is available after AI analysis is complete")
    model_version = db.get(ModelVersion, prediction.model_version_id)
    if model_version is None:
        raise HTTPException(status_code=500, detail="Prediction model version is unavailable")

    try:
        resolve_upload_file(prediction.gradcam_path)
    except (UnsafeStoragePath, OSError, RuntimeError):
        raise HTTPException(status_code=404, detail="Report image not found")
    pdf = build_scan_report(scan, patient, prediction, model_version)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="medscan-report-{scan.id}.pdf"'},
    )


@router.post("/{scan_id}/analyze")
def analyze_scan(
    scan_id: UUID,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role("patient")),
):
    scan = db.get(Scan, scan_id)
    if scan is None or scan.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="Scan not found")
    if scan.quality_status == ScanQualityStatus.poor and not scan.user_continued_anyway:
        raise HTTPException(status_code=409, detail="Continue anyway is required before analyzing a poor-quality scan")

    existing = db.scalar(select(Prediction).where(Prediction.scan_id == scan.id))
    if existing is not None:
        version = db.get(ModelVersion, existing.model_version_id)
        add_audit_log(db, patient.id, "analysis_run", f"scans/{scan.id}")
        db.commit()
        return {"scan_id": scan.id, **_prediction_response(existing, version)}

    try:
        original_path = resolve_upload_file(scan.storage_path)
    except (UnsafeStoragePath, OSError, RuntimeError):
        raise HTTPException(status_code=404, detail="Scan image not found")
    result = run_analysis(scan.id, str(original_path))

    expected = ("normal_probability", "pneumonia_probability", "tuberculosis_probability", "other_probability", "ai_confidence", "gradcam_path", "model_version")
    missing = [key for key in expected if key not in result]
    if missing:
        raise HTTPException(status_code=500, detail=f"Inference result is missing fields: {', '.join(missing)}")

    upload_dir = Path(settings.upload_dir)
    gradcam_destination = upload_dir / str(scan.id) / "gradcam.png"
    source_gradcam = Path(result["gradcam_path"])
    if not source_gradcam.is_file():
        raise HTTPException(status_code=500, detail="Grad-CAM output image was not created")
    gradcam_destination.parent.mkdir(parents=True, exist_ok=True)
    if source_gradcam.resolve() != gradcam_destination.resolve():
        shutil.copyfile(source_gradcam, gradcam_destination)

    model_version = db.scalar(select(ModelVersion).where(ModelVersion.version == str(result["model_version"])))
    if model_version is None:
        db.query(ModelVersion).filter(ModelVersion.is_active.is_(True)).update({ModelVersion.is_active: False})
        model_version = ModelVersion(version=str(result["model_version"]), model_path="app/ml/model/mobilenetv2-v1.0.keras", is_active=True)
        db.add(model_version)
        db.flush()

    prediction = Prediction(
        scan_id=scan.id,
        model_version_id=model_version.id,
        normal_probability=float(result["normal_probability"]),
        pneumonia_probability=float(result["pneumonia_probability"]),
        tuberculosis_probability=float(result["tuberculosis_probability"]),
        other_probability=float(result["other_probability"]),
        ai_confidence=float(result["ai_confidence"]),
        gradcam_path=str(gradcam_destination),
    )
    db.add(prediction)
    add_audit_log(db, patient.id, "analysis_run", f"scans/{scan.id}")
    db.commit()
    db.refresh(prediction)
    return {"scan_id": scan.id, **_prediction_response(prediction, model_version)}


@router.get("/{scan_id}/result")
def get_scan_result(
    scan_id: UUID,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role("patient")),
):
    scan = db.get(Scan, scan_id)
    if scan is None or scan.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="Scan not found")
    prediction = db.scalar(select(Prediction).where(Prediction.scan_id == scan.id))
    prediction_data = None
    if prediction is not None:
        model_version = db.get(ModelVersion, prediction.model_version_id)
        prediction_data = {**_prediction_response(prediction, model_version), "created_at": prediction.created_at}
    review = db.scalar(select(DoctorReview).where(DoctorReview.scan_id == scan.id))
    review_data = None
    if review is not None:
        reviewed_by = db.get(User, review.reviewed_by) if review.reviewed_by else None
        review_data = {
            "id": review.id,
            "status": review.status.upper(),
            "decision": review.decision,
            "notes": review.notes,
            "requested_at": review.requested_at,
            "reviewed_at": review.reviewed_at,
            "doctor_name": reviewed_by.full_name if reviewed_by else None,
        }
    return {
        "scan_id": scan.id,
        "quality": {
            "quality_score": scan.quality_score,
            "quality_status": scan.quality_status.value,
            "quality_issues": scan.quality_issues,
            "user_continued_anyway": scan.user_continued_anyway,
        },
        "prediction": prediction_data,
        "doctor_review": review_data,
        "images": {
            "original": f"/scans/{scan.id}/images/original",
            "gradcam": f"/scans/{scan.id}/images/gradcam" if prediction is not None else None,
        },
    }


@router.get("/{scan_id}/images/{image_kind}")
def get_scan_image(
    scan_id: UUID,
    image_kind: str,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role("patient")),
):
    scan = db.get(Scan, scan_id)
    if scan is None or scan.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="Scan not found")
    if image_kind == "original":
        image_path = Path(scan.storage_path)
    elif image_kind == "gradcam":
        prediction = db.scalar(select(Prediction).where(Prediction.scan_id == scan.id))
        if prediction is None:
            raise HTTPException(status_code=404, detail="Grad-CAM image not available")
        image_path = Path(prediction.gradcam_path)
    else:
        raise HTTPException(status_code=404, detail="Image not found")
    try:
        image_path = resolve_upload_file(str(image_path))
    except (UnsafeStoragePath, OSError, RuntimeError):
        raise HTTPException(status_code=404, detail="Image file not found")
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="Image file not found")
    return FileResponse(image_path, media_type="image/png")
