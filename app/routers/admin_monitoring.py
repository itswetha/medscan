from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import require_role
from app.models.model_version import ModelVersion
from app.models.prediction import Prediction
from app.models.user import User
from app.services.audit import add_audit_log

router = APIRouter(prefix="/admin/monitoring", tags=["admin monitoring"])


@router.get("")
def get_monitoring_summary(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    total, average = db.execute(
        select(func.count(Prediction.id), func.avg(Prediction.ai_confidence))
    ).one()
    total = int(total or 0)

    top_class = case(
        (
            (Prediction.normal_probability >= Prediction.pneumonia_probability)
            & (Prediction.normal_probability >= Prediction.tuberculosis_probability)
            & (Prediction.normal_probability >= Prediction.other_probability),
            "Normal",
        ),
        (
            (Prediction.pneumonia_probability >= Prediction.tuberculosis_probability)
            & (Prediction.pneumonia_probability >= Prediction.other_probability),
            "Pneumonia",
        ),
        (Prediction.tuberculosis_probability >= Prediction.other_probability, "Tuberculosis"),
        else_="Other",
    )
    class_counts = db.execute(
        select(top_class.label("top_class"), func.count(Prediction.id))
        .group_by(top_class)
    ).all()
    distribution = {"Normal": 0.0, "Pneumonia": 0.0, "Tuberculosis": 0.0, "Other": 0.0}
    if total:
        for label, count in class_counts:
            distribution[label] = float(count) * 100.0 / total

    version_rows = db.execute(
        select(ModelVersion.version, func.count(Prediction.id))
        .join(Prediction, Prediction.model_version_id == ModelVersion.id)
        .group_by(ModelVersion.version)
        .order_by(ModelVersion.version)
    ).all()
    response = {
        "total_predictions": total,
        "average_confidence": float(average) if average is not None else None,
        "class_distribution": distribution,
        "model_version_counts": {version: int(count) for version, count in version_rows},
    }
    add_audit_log(db, admin.id, "admin_monitoring_access", "admin/monitoring")
    db.commit()
    return response


@router.get("/trend")
def get_confidence_trend(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    week_start = func.date_trunc("week", Prediction.created_at).label("week_start")
    rows = db.execute(
        select(week_start, func.avg(Prediction.ai_confidence).label("average_confidence"))
        .group_by(week_start)
        .order_by(week_start.asc())
    ).all()
    response = [
        {"week_start": start, "average_confidence": float(average)}
        for start, average in rows
    ]
    add_audit_log(db, admin.id, "admin_monitoring_access", "admin/monitoring/trend")
    db.commit()
    return response
