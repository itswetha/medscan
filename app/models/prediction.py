from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scan_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("scans.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    model_version_id: Mapped[int] = mapped_column(ForeignKey("model_versions.id"), nullable=False, index=True)
    normal_probability: Mapped[float] = mapped_column(Float, nullable=False)
    pneumonia_probability: Mapped[float] = mapped_column(Float, nullable=False)
    tuberculosis_probability: Mapped[float] = mapped_column(Float, nullable=False)
    other_probability: Mapped[float] = mapped_column(Float, nullable=False)
    ai_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    gradcam_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
