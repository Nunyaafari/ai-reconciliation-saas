import json
import logging
import time
from datetime import datetime
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.database.models import ProcessingJob, UploadSession
from app.observability import record_job_duration, record_job_event
from app.schemas import ProcessingJobResponse
from app.services.file_storage_service import file_storage_service
from app.services.processing_service import ProcessingService
from app.services.queue_service import get_queue

logger = logging.getLogger(__name__)

ACTIVE_JOB_STATUSES = ("queued", "running")


class JobService:
    """Create, update, and serialize persisted processing jobs."""

    def create_extraction_job(
        self,
        upload_session_id: UUID,
        org_id: UUID,
        actor_user_id: UUID | None,
        job_payload: dict | None,
        db: Session,
    ) -> tuple[ProcessingJob, bool]:
        existing_job = (
            db.query(ProcessingJob)
            .filter(
                ProcessingJob.job_type == "extraction",
                ProcessingJob.upload_session_id == upload_session_id,
                ProcessingJob.status.in_(ACTIVE_JOB_STATUSES),
            )
            .order_by(ProcessingJob.created_at.desc())
            .first()
        )

        if existing_job:
            return existing_job, False

        job = ProcessingJob(
            org_id=org_id,
            upload_session_id=upload_session_id,
            actor_user_id=actor_user_id,
            job_type="extraction",
            job_payload=json.dumps(job_payload or {}),
            status="queued",
            progress_percent=0,
            attempt_count=0,
            max_retries=settings.JOB_MAX_RETRIES,
            message="Queued extraction job",
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job, True

    def create_reconciliation_job(
        self,
        org_id: UUID,
        actor_user_id: UUID | None,
        job_payload: dict | None,
        db: Session,
    ) -> ProcessingJob:
        job = ProcessingJob(
            org_id=org_id,
            actor_user_id=actor_user_id,
            job_type="reconciliation",
            job_payload=json.dumps(job_payload or {}),
            status="queued",
            progress_percent=0,
            attempt_count=0,
            max_retries=settings.JOB_MAX_RETRIES,
            message="Queued reconciliation job",
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def get_job_or_404(self, job_id: UUID, db: Session) -> ProcessingJob:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Processing job not found")
        return job

    def update_progress(
        self,
        job: ProcessingJob,
        db: Session,
        *,
        status: str | None = None,
        progress_percent: int | None = None,
        message: str | None = None,
    ) -> ProcessingJob:
        if status is not None:
            job.status = status
            if status == "running" and job.started_at is None:
                job.started_at = datetime.utcnow()
        if progress_percent is not None:
            job.progress_percent = progress_percent
        if message is not None:
            job.message = message
        db.commit()
        db.refresh(job)
        return job

    def mark_retry_queued(
        self,
        job: ProcessingJob,
        db: Session,
        *,
        message: str = "Retry queued",
    ) -> ProcessingJob:
        job.status = "queued"
        job.progress_percent = 0
        job.error_message = None
        job.message = message
        job.started_at = None
        job.completed_at = None
        job.last_retry_at = datetime.utcnow()
        job.dead_lettered_at = None
        db.commit()
        db.refresh(job)
        return job

    def complete_job(
        self,
        job: ProcessingJob,
        result_payload: object,
        db: Session,
        message: str,
    ) -> ProcessingJob:
        job.status = "completed"
        job.progress_percent = 100
        job.message = message
        job.result_payload = json.dumps(jsonable_encoder(result_payload))
        job.error_message = None
        job.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
        return job

    def fail_job(
        self,
        job: ProcessingJob,
        error_message: str,
        db: Session,
    ) -> ProcessingJob:
        exhausted_retries = job.attempt_count >= job.max_retries
        job.status = "dead_lettered" if exhausted_retries else "failed"
        job.error_message = error_message
        job.message = (
            "Job moved to dead-letter queue"
            if exhausted_retries
            else "Job failed"
        )
        job.completed_at = datetime.utcnow()
        job.dead_lettered_at = datetime.utcnow() if exhausted_retries else None
        db.commit()
        db.refresh(job)
        return job

    def decode_job_payload(self, job: ProcessingJob) -> dict:
        if not job.job_payload:
            return {}
        try:
            return json.loads(job.job_payload)
        except json.JSONDecodeError:
            return {}

    def serialize_job(self, job: ProcessingJob) -> ProcessingJobResponse:
        result_payload = None
        if job.result_payload:
            try:
                result_payload = json.loads(job.result_payload)
            except json.JSONDecodeError:
                logger.warning("Could not decode result_payload for job %s", job.id)

        return ProcessingJobResponse(
            id=job.id,
            org_id=job.org_id,
            upload_session_id=job.upload_session_id,
            job_type=job.job_type,
            status=job.status,
            progress_percent=job.progress_percent,
            attempt_count=job.attempt_count,
            max_retries=job.max_retries,
            message=job.message,
            result_payload=result_payload,
            error_message=job.error_message,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            last_retry_at=job.last_retry_at,
            dead_lettered_at=job.dead_lettered_at,
        )


job_service = JobService()
processing_service = ProcessingService()


def queue_extraction_job(job_id: UUID, upload_session_id: UUID, stored_file_path: str) -> None:
    get_queue().enqueue(
        run_extraction_job,
        job_id,
        upload_session_id,
        stored_file_path,
        job_timeout="30m",
    )


def queue_reconciliation_job(
    job_id: UUID,
    org_id: UUID,
    bank_session_id: UUID,
    book_session_id: UUID,
) -> None:
    get_queue().enqueue(
        run_reconciliation_job,
        job_id,
        org_id,
        bank_session_id,
        book_session_id,
        job_timeout="30m",
    )


def run_extraction_job(job_id: UUID, upload_session_id: UUID, stored_file_path: str) -> None:
    """Execute extraction in the background and persist progress/results."""
    db = SessionLocal()
    started_at = time.perf_counter()
    job = None
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        session = db.query(UploadSession).filter(UploadSession.id == upload_session_id).first()

        if not job:
            logger.error(
                "Extraction job bootstrap failed for missing job=%s session=%s",
                job_id,
                upload_session_id,
            )
            return

        if not session:
            logger.error(
                "Extraction job bootstrap failed for job=%s session=%s",
                job_id,
                upload_session_id,
            )
            job_service.fail_job(job, "Upload session not found", db)
            return

        if not stored_file_path or not file_storage_service.exists(stored_file_path):
            job_service.fail_job(job, "Stored upload file not found", db)
            logger.error(
                "Extraction job could not find persisted upload file",
                extra={
                    "event": "job.bootstrap_missing_file",
                    "job_type": "extraction",
                    "job_id": str(job_id),
                    "upload_session_id": str(upload_session_id),
                    "stored_file_path": stored_file_path,
                },
            )
            return

        job_service.update_progress(
            job,
            db,
            status="running",
            progress_percent=15,
            message="Extracting tables and transaction rows",
        )
        job.attempt_count += 1
        db.commit()
        db.refresh(job)
        record_job_event("extraction", "started")
        logger.info(
            "Started extraction job",
            extra={
                "event": "job.started",
                "job_type": "extraction",
                "job_id": str(job_id),
                "upload_session_id": str(upload_session_id),
            },
        )

        file_content = file_storage_service.read_upload(stored_file_path)
        preview = processing_service.build_extraction_preview(
            session=session,
            file_content=file_content,
            db=db,
        )

        job_service.complete_job(
            job,
            result_payload=preview.model_dump(mode="json"),
            db=db,
            message="Preview ready for mapping",
        )
        duration = time.perf_counter() - started_at
        record_job_event("extraction", "completed")
        record_job_duration("extraction", "completed", duration)
        logger.info(
            "Completed extraction job",
            extra={
                "event": "job.completed",
                "job_type": "extraction",
                "job_id": str(job_id),
                "upload_session_id": str(upload_session_id),
                "duration_ms": round(duration * 1000, 2),
            },
        )
    except Exception as exc:
        if job is not None and job.attempt_count < job.max_retries:
            next_attempt = job.attempt_count + 1
            job = job_service.mark_retry_queued(
                job,
                db,
                message=f"Retry {next_attempt} of {job.max_retries} queued after failure",
            )
            queue_extraction_job(job.id, upload_session_id, stored_file_path)
            duration = time.perf_counter() - started_at
            record_job_event("extraction", "retried")
            record_job_duration("extraction", "retried", duration)
            logger.warning(
                "Extraction background job failed and was re-queued",
                extra={
                    "event": "job.retried",
                    "job_type": "extraction",
                    "job_id": str(job_id),
                    "upload_session_id": str(upload_session_id),
                    "attempt_count": job.attempt_count,
                    "max_retries": job.max_retries,
                    "duration_ms": round(duration * 1000, 2),
                    "error": str(exc),
                },
            )
            return

        if job is not None:
            job = job_service.fail_job(job, str(exc), db)
        duration = time.perf_counter() - started_at
        failure_state = "dead_lettered" if job and job.status == "dead_lettered" else "failed"
        record_job_event("extraction", failure_state)
        record_job_duration("extraction", failure_state, duration)
        logger.error(
            "Extraction background job failed",
            extra={
                "event": "job.failed",
                "job_type": "extraction",
                "job_id": str(job_id),
                "upload_session_id": str(upload_session_id),
                "job_status": failure_state,
                "duration_ms": round(duration * 1000, 2),
                "error": str(exc),
            },
        )
    finally:
        db.close()


def run_reconciliation_job(
    job_id: UUID,
    org_id: UUID,
    bank_session_id: UUID,
    book_session_id: UUID,
) -> None:
    """Execute reconciliation in the background and persist progress/results."""
    db = SessionLocal()
    started_at = time.perf_counter()
    job = None
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            logger.error("Reconciliation job bootstrap failed for job=%s", job_id)
            return

        job_service.update_progress(
            job,
            db,
            status="running",
            progress_percent=20,
            message="Matching transactions and building suggestions",
        )
        job.attempt_count += 1
        db.commit()
        db.refresh(job)
        record_job_event("reconciliation", "started")
        logger.info(
            "Started reconciliation job",
            extra={
                "event": "job.started",
                "job_type": "reconciliation",
                "job_id": str(job_id),
                "org_id": str(org_id),
                "bank_session_id": str(bank_session_id),
                "book_session_id": str(book_session_id),
            },
        )

        result = processing_service.run_reconciliation(
            org_id=org_id,
            bank_session_id=bank_session_id,
            book_session_id=book_session_id,
            db=db,
        )

        job_service.complete_job(
            job,
            result_payload=result.model_dump(mode="json"),
            db=db,
            message="Reconciliation results ready",
        )
        duration = time.perf_counter() - started_at
        record_job_event("reconciliation", "completed")
        record_job_duration("reconciliation", "completed", duration)
        logger.info(
            "Completed reconciliation job",
            extra={
                "event": "job.completed",
                "job_type": "reconciliation",
                "job_id": str(job_id),
                "org_id": str(org_id),
                "duration_ms": round(duration * 1000, 2),
            },
        )
    except Exception as exc:
        if job is not None and job.attempt_count < job.max_retries:
            next_attempt = job.attempt_count + 1
            job = job_service.mark_retry_queued(
                job,
                db,
                message=f"Retry {next_attempt} of {job.max_retries} queued after failure",
            )
            queue_reconciliation_job(
                job.id,
                org_id,
                bank_session_id,
                book_session_id,
            )
            duration = time.perf_counter() - started_at
            record_job_event("reconciliation", "retried")
            record_job_duration("reconciliation", "retried", duration)
            logger.warning(
                "Reconciliation background job failed and was re-queued",
                extra={
                    "event": "job.retried",
                    "job_type": "reconciliation",
                    "job_id": str(job_id),
                    "org_id": str(org_id),
                    "attempt_count": job.attempt_count,
                    "max_retries": job.max_retries,
                    "duration_ms": round(duration * 1000, 2),
                    "error": str(exc),
                },
            )
            return

        if job is not None:
            job = job_service.fail_job(job, str(exc), db)
        duration = time.perf_counter() - started_at
        failure_state = "dead_lettered" if job and job.status == "dead_lettered" else "failed"
        record_job_event("reconciliation", failure_state)
        record_job_duration("reconciliation", failure_state, duration)
        logger.error(
            "Reconciliation background job failed",
            extra={
                "event": "job.failed",
                "job_type": "reconciliation",
                "job_id": str(job_id),
                "org_id": str(org_id),
                "job_status": failure_state,
                "duration_ms": round(duration * 1000, 2),
                "error": str(exc),
            },
        )
    finally:
        db.close()
