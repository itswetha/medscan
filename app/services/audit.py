from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def add_audit_log(db: Session, user_id: UUID | None, action: str, resource: str) -> None:
    db.add(AuditLog(user_id=user_id, action=action, resource=resource))
