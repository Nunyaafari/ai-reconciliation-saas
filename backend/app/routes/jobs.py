from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.database.models import ProcessingJob, UploadSession, User
from app.dependencies.auth import get_current_user, get_super_admin_user
from app.observability import record_job_event
from app.schemas import ProcessingJobResponse
from app.services.audit_service import audit_service
from app.services.job_service import (
    job_service,
    queue_extraction_job,
    queue_reconciliation_job,
)

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


def get_current_org_job(job_id: UUID, current_user: User, db: Session) -> ProcessingJob:
    job = job_service.get_job_or_404(job_id, db)
    job_org_id = job.org_id
    if job_org_id is None and job.upload_session_id is not None:
        upload_session = (
            db.query(UploadSession)
            .filter(UploadSession.id == job.upload_session_id)
            .first()
        )
        job_org_id = upload_session.org_id if upload_session else None
    if str(job_org_id) != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Cross-tenant access denied")
    return job


@router.get("", response_model=list[ProcessingJobResponse])
async def list_processing_jobs(
    status: str | None = Query(default=None),
    job_type: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent jobs for the current organization."""
    query = (
        db.query(ProcessingJob)
        .filter(ProcessingJob.org_id == current_user.org_id)
        .order_by(ProcessingJob.created_at.desc())
    )
    if status:
        query = query.filter(ProcessingJob.status == status)
    if job_type:
        query = query.filter(ProcessingJob.job_type == job_type)

    jobs = query.limit(limit).all()
    return [job_service.serialize_job(job) for job in jobs]


@router.get("/{job_id}", response_model=ProcessingJobResponse)
async def get_processing_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current status/result for a background processing job."""
    job = get_current_org_job(job_id, current_user, db)
    return job_service.serialize_job(job)


@router.post("/{job_id}/retry", response_model=ProcessingJobResponse)
async def retry_processing_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """Super-admin-only: requeue a failed or dead-lettered job."""
    job = get_current_org_job(job_id, current_user, db)
    if job.status not in {"failed", "dead_lettered"}:
        raise HTTPException(status_code=409, detail="Only failed or dead-lettered jobs can be retried")

    payload = job_service.decode_job_payload(job)
    if job.job_type == "extraction":
        upload_session_id = payload.get("upload_session_id") or str(job.upload_session_id or "")
        file_path = payload.get("file_path")
        if not upload_session_id or not file_path:
            raise HTTPException(status_code=400, detail="Extraction job payload is incomplete")
        job = job_service.mark_retry_queued(
            job,
            db,
            message="Manual retry queued for extraction job",
        )
        queue_extraction_job(job.id, UUID(str(upload_session_id)), file_path)
    elif job.job_type == "reconciliation":
        org_id = payload.get("org_id") or str(job.org_id or "")
        bank_session_id = payload.get("bank_session_id")
        book_session_id = payload.get("book_session_id")
        if not org_id or not bank_session_id or not book_session_id:
            raise HTTPException(status_code=400, detail="Reconciliation job payload is incomplete")
        job = job_service.mark_retry_queued(
            job,
            db,
            message="Manual retry queued for reconciliation job",
        )
        queue_reconciliation_job(
            job.id,
            UUID(str(org_id)),
            UUID(str(bank_session_id)),
            UUID(str(book_session_id)),
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported job type: {job.job_type}")

    record_job_event(job.job_type, "manual_retry_enqueued")
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="job.retry_requested",
        entity_type="processing_job",
        entity_id=str(job.id),
        metadata={"job_type": job.job_type},
    )
    return job_service.serialize_job(job)
