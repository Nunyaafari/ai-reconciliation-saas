from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import AuditLog, User
from app.dependencies.auth import get_current_user
from app.schemas import AuditLogResponse
from app.services.audit_service import audit_service

router = APIRouter(prefix="/api/audit", tags=["Audit"])


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    action: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent audit events for the current organization."""
    query = (
        db.query(AuditLog)
        .filter(AuditLog.org_id == current_user.org_id)
        .order_by(AuditLog.created_at.desc())
    )
    if action:
        query = query.filter(AuditLog.action == action)

    logs = query.limit(limit).all()
    return [audit_service.serialize(log) for log in logs]
