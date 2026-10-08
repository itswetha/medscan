from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.storage import resolve_upload_file
from app.dependencies.auth import get_current_user, require_role
from app.models.user import User
from app.schemas.doctors import DoctorProfileRead, DoctorProfileUpdate

router = APIRouter(prefix="/doctors", tags=["doctors"])
MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


@router.get("/me/profile", response_model=DoctorProfileRead)
def get_my_profile(
    doctor: User = Depends(require_role("doctor")),
):
    return doctor


@router.get("", response_model=list[DoctorProfileRead])
def list_doctors(
    search: str | None = Query(default=None, max_length=255),
    specialization: str | None = Query(default=None, max_length=255),
    db: Session = Depends(get_db),
    _patient: User = Depends(require_role("patient")),
):
    query = select(User).where(User.role == "doctor", User.specialization.is_not(None))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(User.full_name.ilike(term), User.specialization.ilike(term)))
    if specialization and specialization.strip():
        query = query.where(func.lower(User.specialization) == specialization.strip().lower())
    return db.scalars(query.order_by(User.full_name)).all()


@router.patch("/me/profile", response_model=DoctorProfileRead)
def update_my_profile(
    payload: DoctorProfileUpdate,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role("doctor")),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(doctor, field, value)
    db.commit()
    db.refresh(doctor)
    return doctor


@router.post("/me/profile/photo", response_model=DoctorProfileRead)
async def upload_my_profile_photo(
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role("doctor")),
):
    from io import BytesIO
    from PIL import Image, UnidentifiedImageError

    content = await photo.read(MAX_PROFILE_PHOTO_BYTES + 1)
    if len(content) > MAX_PROFILE_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Profile photos must be 5 MB or smaller")
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
            image_format = image.format
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="Upload a valid JPEG, PNG, or WebP image")
    extension = ALLOWED_IMAGE_FORMATS.get(image_format or "")
    if extension is None:
        raise HTTPException(status_code=400, detail="Upload a valid JPEG, PNG, or WebP image")

    destination = (Path(settings.upload_dir) / "doctor_profiles" / f"{doctor.id}-{uuid4().hex}{extension}").resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    old_path = doctor.profile_photo_path
    doctor.profile_photo_path = str(destination)
    try:
        db.commit()
        db.refresh(doctor)
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        raise
    if old_path:
        try:
            resolve_upload_file(old_path).unlink(missing_ok=True)
        except (OSError, ValueError):
            pass
    return doctor


@router.get("/{doctor_id}/photo")
def get_doctor_photo(
    doctor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = db.get(User, doctor_id)
    if doctor is None or doctor.role != "doctor" or not doctor.profile_photo_path:
        raise HTTPException(status_code=404, detail="Doctor photo not found")
    if current_user.role != "patient" and not (current_user.role == "doctor" and current_user.id == doctor.id):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    try:
        path = resolve_upload_file(doctor.profile_photo_path)
    except ValueError:
        raise HTTPException(status_code=404, detail="Doctor photo not found")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Doctor photo not found")
    media_type = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media_type, headers={"Cache-Control": "private, max-age=300"})
