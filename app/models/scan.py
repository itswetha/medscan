from datetime import datetime, timezone
from enum import Enum as PyEnum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScanQualityStatus(str, PyEnum):
    good = "good"
    poor = "poor"


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    quality_score: Mapped[int] = mapped_column(Integer, nullable=False)
    quality_status: Mapped[ScanQualityStatus] = mapped_column(
        Enum(ScanQualityStatus, name="scan_quality_status", values_callable=lambda enum: [member.value for member in enum]),
        nullable=False,
    )
    quality_issues: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    user_continued_anyway: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    doctor_review_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
