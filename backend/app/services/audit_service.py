import json
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.models import AuditLog
from app.schemas import AuditLogResponse


class AuditService:
    """Helpers for writing and serializing org audit events."""

    def log(
        self,
        *,
        db: Session,
        org_id: UUID,
        action: str,
        entity_type: str,
        actor_user_id: UUID | None = None,
        entity_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLog:
        audit_log = AuditLog(
            org_id=org_id,
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=json.dumps(metadata or {}),
        )
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        return audit_log

    def list_for_org(
        self,
        *,
        db: Session,
        org_id: UUID,
        limit: int = 50,
    ) -> list[AuditLog]:
        return (
            db.query(AuditLog)
            .filter(AuditLog.org_id == org_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )

    def serialize(self, audit_log: AuditLog) -> AuditLogResponse:
        metadata_json = {}
        if audit_log.metadata_json:
            try:
                metadata_json = json.loads(audit_log.metadata_json)
            except json.JSONDecodeError:
                metadata_json = {"raw": audit_log.metadata_json}

        return AuditLogResponse(
            id=audit_log.id,
            org_id=audit_log.org_id,
            actor_user_id=audit_log.actor_user_id,
            actor_user_name=audit_log.actor_user.name if audit_log.actor_user else None,
            actor_user_email=audit_log.actor_user.email if audit_log.actor_user else None,
            action=audit_log.action,
            entity_type=audit_log.entity_type,
            entity_id=audit_log.entity_id,
            metadata_json=metadata_json,
            created_at=audit_log.created_at,
        )


audit_service = AuditService()
