from datetime import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.database.models import (
    BankTransaction,
    BookTransaction,
    UploadSession,
    MatchGroup,
    Organization,
    ReconciliationSession,
    User,
)
from app.dependencies.auth import ensure_org_access, get_admin_user, get_current_user
from app.observability import record_job_event
from app.schemas import (
    ProcessingJobResponse,
    ReconciliationRequest,
    ReconciliationStatusResponse,
    MatchGroupCreate,
    MatchGroupResponse,
    MatchGroupApprove,
    ReconciliationSessionResponse,
)
from app.services.job_service import job_service, queue_reconciliation_job
from app.services.audit_service import audit_service
from app.services.processing_service import ProcessingService
from app.services.reconciliation_service import ReconciliationService

router = APIRouter(prefix="/api/reconciliation", tags=["Reconciliation"])
logger = logging.getLogger(__name__)

processing_service = ProcessingService()
reconciliation_service = ReconciliationService()


def get_org_or_404(org_id: UUID, db: Session, current_user: User) -> Organization:
    """Get organization or raise 404."""
    ensure_org_access(org_id, current_user)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def get_upload_session_or_404(
    session_id: UUID,
    db: Session,
    current_user: User,
) -> UploadSession:
    """Get upload session or raise 404."""
    session = (
        db.query(UploadSession)
        .filter(
            UploadSession.id == session_id,
            UploadSession.org_id == current_user.org_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    return session


def get_reconciliation_session_or_404(
    session_id: UUID,
    db: Session,
    current_user: User,
) -> ReconciliationSession:
    reconciliation_session = (
        db.query(ReconciliationSession)
        .filter(
            ReconciliationSession.id == session_id,
            ReconciliationSession.org_id == current_user.org_id,
        )
        .first()
    )
    if not reconciliation_session:
        raise HTTPException(status_code=404, detail="Reconciliation session not found")
    return reconciliation_session


def get_match_group_or_404(
    match_id: UUID,
    db: Session,
    current_user: User,
) -> MatchGroup:
    match_group = (
        db.query(MatchGroup)
        .filter(
            MatchGroup.id == match_id,
            MatchGroup.org_id == current_user.org_id,
        )
        .first()
    )
    if not match_group:
        raise HTTPException(status_code=404, detail="Match group not found")
    return match_group


@router.post("/start/{org_id}", response_model=ReconciliationStatusResponse)
async def start_reconciliation(
    org_id: UUID,
    request: ReconciliationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Start reconciliation matching between bank and book transactions.

    The matching engine uses signed amounts that already encode the
    bank-vs-cash-book debit/credit inversion:
    - bank credit == positive, bank debit == negative
    - cash-book debit == positive, cash-book credit == negative
    """
    get_org_or_404(org_id, db, current_user)
    get_upload_session_or_404(request.bank_upload_session_id, db, current_user)
    get_upload_session_or_404(request.book_upload_session_id, db, current_user)

    try:
        return processing_service.run_reconciliation(
            org_id=org_id,
            bank_session_id=request.bank_upload_session_id,
            book_session_id=request.book_upload_session_id,
            db=db,
        )
    except Exception as exc:
        logger.error("Reconciliation failed for org %s: %s", org_id, exc)
        raise HTTPException(status_code=400, detail=f"Reconciliation failed: {exc}")


@router.post("/start-async/{org_id}", response_model=ProcessingJobResponse)
async def start_reconciliation_async(
    org_id: UUID,
    request: ReconciliationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Queue reconciliation work and return a polling job handle."""
    get_org_or_404(org_id, db, current_user)
    get_upload_session_or_404(request.bank_upload_session_id, db, current_user)
    get_upload_session_or_404(request.book_upload_session_id, db, current_user)

    job = job_service.create_reconciliation_job(
        org_id=org_id,
        actor_user_id=current_user.id,
        job_payload={
            "org_id": str(org_id),
            "bank_session_id": str(request.bank_upload_session_id),
            "book_session_id": str(request.book_upload_session_id),
        },
        db=db,
    )
    queue_reconciliation_job(
        job.id,
        org_id,
        request.bank_upload_session_id,
        request.book_upload_session_id,
    )
    record_job_event("reconciliation", "enqueued")
    logger.info("Queued reconciliation job %s for org %s", job.id, org_id)
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="job.enqueued",
        entity_type="processing_job",
        entity_id=str(job.id),
        metadata={
            "job_type": "reconciliation",
            "bank_session_id": str(request.bank_upload_session_id),
            "book_session_id": str(request.book_upload_session_id),
        },
    )
    return job_service.serialize_job(job)


@router.post("/match/{org_id}", response_model=MatchGroupResponse)
async def create_manual_match(
    org_id: UUID,
    match_request: MatchGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Manually create a match between transactions."""
    get_org_or_404(org_id, db, current_user)

    try:
        bank_txs = db.query(BankTransaction).filter(
            BankTransaction.id.in_(match_request.bank_transaction_ids),
            BankTransaction.org_id == current_user.org_id,
        ).all()
        book_txs = db.query(BookTransaction).filter(
            BookTransaction.id.in_(match_request.book_transaction_ids),
            BookTransaction.org_id == current_user.org_id,
        ).all()

        if not bank_txs or not book_txs:
            raise HTTPException(status_code=400, detail="Invalid transaction IDs")

        total_bank = sum(float(tx.amount) for tx in bank_txs)
        total_book = sum(float(tx.amount) for tx in book_txs)
        variance = abs(total_bank - total_book)
        match_type = f"{len(bank_txs)}:{len(book_txs)}"

        match_group = MatchGroup(
            org_id=org_id,
            match_type=match_type,
            total_bank_amount=total_bank,
            total_book_amount=total_book,
            variance=variance,
            confidence_score=match_request.confidence_score,
            notes=match_request.notes,
            status="pending",
        )
        db.add(match_group)
        db.flush()

        for tx in bank_txs:
            tx.match_group_id = match_group.id
            tx.status = "pending"

        for tx in book_txs:
            tx.match_group_id = match_group.id
            tx.status = "pending"

        db.commit()
        db.refresh(match_group)

        logger.info("Created manual match %s for org %s", match_group.id, org_id)
        audit_service.log(
            db=db,
            org_id=current_user.org_id,
            actor_user_id=current_user.id,
            action="match.created",
            entity_type="match_group",
            entity_id=str(match_group.id),
            metadata={
                "match_type": match_type,
                "confidence_score": match_request.confidence_score,
            },
        )
        return reconciliation_service.serialize_match_group(match_group)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Manual match creation failed: %s", exc)
        raise HTTPException(status_code=400, detail=f"Match creation failed: {exc}")


@router.post("/match/{match_id}/approve", response_model=MatchGroupResponse)
async def approve_match(
    match_id: UUID,
    approve_request: MatchGroupApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve a pending match."""
    match_group = get_match_group_or_404(match_id, db, current_user)

    match_group.status = "approved"
    match_group.approved_at = datetime.utcnow()
    match_group.approved_by_user_id = current_user.id
    if approve_request.notes:
        match_group.notes = approve_request.notes

    db.query(BankTransaction).filter(
        BankTransaction.match_group_id == match_id,
        BankTransaction.org_id == current_user.org_id,
    ).update({"status": "matched"})
    db.query(BookTransaction).filter(
        BookTransaction.match_group_id == match_id,
        BookTransaction.org_id == current_user.org_id,
    ).update({"status": "matched"})

    db.commit()
    db.refresh(match_group)
    logger.info("Approved match %s", match_id)
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="match.approved",
        entity_type="match_group",
        entity_id=str(match_id),
        metadata={"notes": approve_request.notes or ""},
    )
    return reconciliation_service.serialize_match_group(match_group)


@router.delete("/match/{match_id}")
async def reject_match(
    match_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject/delete a match."""
    match_group = get_match_group_or_404(match_id, db, current_user)

    db.query(BankTransaction).filter(
        BankTransaction.match_group_id == match_id,
        BankTransaction.org_id == current_user.org_id,
    ).update({"match_group_id": None, "status": "unreconciled"})
    db.query(BookTransaction).filter(
        BookTransaction.match_group_id == match_id,
        BookTransaction.org_id == current_user.org_id,
    ).update({"match_group_id": None, "status": "unreconciled"})

    db.delete(match_group)
    db.commit()
    logger.info("Rejected match %s", match_id)
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="match.rejected",
        entity_type="match_group",
        entity_id=str(match_id),
    )
    return {"status": "success", "match_id": str(match_id)}


@router.get(
    "/status/{org_id}/{bank_session_id}/{book_session_id}",
    response_model=ReconciliationStatusResponse,
)
async def get_reconciliation_status(
    org_id: UUID,
    bank_session_id: UUID,
    book_session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current reconciliation status without re-running the matching algorithm."""
    get_org_or_404(org_id, db, current_user)
    get_upload_session_or_404(bank_session_id, db, current_user)
    get_upload_session_or_404(book_session_id, db, current_user)
    return processing_service.build_status_response(
        org_id=org_id,
        bank_session_id=bank_session_id,
        book_session_id=book_session_id,
        db=db,
    )


@router.get(
    "/sessions/{org_id}",
    response_model=list[ReconciliationSessionResponse],
)
async def list_reconciliation_sessions(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List monthly reconciliation sessions for an organization."""
    get_org_or_404(org_id, db, current_user)
    sessions = (
        db.query(ReconciliationSession)
        .filter(ReconciliationSession.org_id == current_user.org_id)
        .order_by(ReconciliationSession.period_month.desc())
        .all()
    )
    return [
        ReconciliationSessionResponse.model_validate(reconciliation_session)
        for reconciliation_session in sessions
    ]


@router.post(
    "/session/{session_id}/close",
    response_model=ReconciliationSessionResponse,
)
async def close_reconciliation_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Close a monthly reconciliation session."""
    reconciliation_session = get_reconciliation_session_or_404(
        session_id,
        db,
        current_user,
    )
    closed_session = reconciliation_service.close_session(reconciliation_session, db)
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="reconciliation_session.closed",
        entity_type="reconciliation_session",
        entity_id=str(session_id),
        metadata={"period_month": closed_session.period_month},
    )
    return ReconciliationSessionResponse.model_validate(closed_session)


@router.post(
    "/session/{session_id}/reopen",
    response_model=ReconciliationSessionResponse,
)
async def reopen_reconciliation_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Reopen a previously closed monthly reconciliation session."""
    reconciliation_session = get_reconciliation_session_or_404(
        session_id,
        db,
        current_user,
    )
    reopened_session = reconciliation_service.reopen_session(reconciliation_session, db)
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="reconciliation_session.reopened",
        entity_type="reconciliation_session",
        entity_id=str(session_id),
        metadata={"period_month": reopened_session.period_month},
    )
    return ReconciliationSessionResponse.model_validate(reopened_session)


@router.get("/report/{org_id}/{bank_session_id}/{book_session_id}")
async def download_reconciliation_report(
    org_id: UUID,
    bank_session_id: UUID,
    book_session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a CSV reconciliation report for the current month."""
    get_org_or_404(org_id, db, current_user)
    get_upload_session_or_404(bank_session_id, db, current_user)
    get_upload_session_or_404(book_session_id, db, current_user)
    bank_transactions, book_transactions = processing_service.get_transactions_for_sessions(
        bank_session_id, book_session_id, db
    )
    reconciliation_session = reconciliation_service.get_or_create_session(
        org_id=org_id,
        bank_upload_session_id=bank_session_id,
        book_upload_session_id=book_session_id,
        bank_transactions=bank_transactions,
        book_transactions=book_transactions,
        db=db,
    )
    db.commit()
    db.refresh(reconciliation_session)
    summary = reconciliation_service.build_summary(
        reconciliation_session=reconciliation_session,
        bank_transactions=bank_transactions,
        book_transactions=book_transactions,
    )
    csv_content = reconciliation_service.build_report_csv(
        reconciliation_session=reconciliation_session,
        summary=summary,
        bank_transactions=bank_transactions,
        book_transactions=book_transactions,
    )

    filename = f"reconciliation-{reconciliation_session.period_month}.csv"
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="report.downloaded",
        entity_type="reconciliation_session",
        entity_id=str(reconciliation_session.id),
        metadata={"period_month": reconciliation_session.period_month},
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
