from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import require_role
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/admin/audit-logs", tags=["admin audit logs"])


@router.get("")
def list_audit_logs(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    entries = db.scalars(
        select(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(100)
    ).all()
    return [
        {
            "id": entry.id,
            "user_id": entry.user_id,
            "action": entry.action,
            "resource": entry.resource,
            "timestamp": entry.timestamp,
        }
        for entry in entries
    ]
