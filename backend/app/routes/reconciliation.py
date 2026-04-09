from datetime import datetime
from decimal import Decimal
import logging
from fastapi import APIRouter, Depends, HTTPException, Response, Body
from sqlalchemy import or_
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
    ReconciliationCloseResponse,
    ReconciliationStatusResponse,
    MatchGroupCreate,
    MatchGroupResponse,
    MatchGroupApprove,
    MatchGroupBulkApproveResponse,
    ReconciliationBalanceUpdateRequest,
    ReconciliationSessionResponse,
    TransactionRemovalUpdateRequest,
    ManualTransactionCreate,
    ReconciliationBlankPeriodRequest,
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


def assert_reconciliation_sessions_open(
    *,
    bank_transactions: list[BankTransaction],
    book_transactions: list[BookTransaction],
    db: Session,
) -> None:
    """Prevent mutating transactions that belong to closed reconciliation months."""
    session_ids = {
        tx.reconciliation_session_id
        for tx in [*bank_transactions, *book_transactions]
        if tx.reconciliation_session_id is not None
    }
    if not session_ids:
        return

    closed_sessions = (
        db.query(ReconciliationSession)
        .filter(
            ReconciliationSession.id.in_(session_ids),
            ReconciliationSession.status == "closed",
        )
        .all()
    )
    if closed_sessions:
        period = closed_sessions[0].period_month
        raise HTTPException(
            status_code=400,
            detail=(
                "This reconciliation month is closed and read-only. "
                f"Reopen month {period} to continue editing."
            ),
        )


@router.post("/start/{org_id}", response_model=ReconciliationStatusResponse)
async def start_reconciliation(
    org_id: UUID,
    request: ReconciliationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Start reconciliation matching between bank and book transactions.

    The matching engine reconciles by lane:
    - bank credits against cash-book debits
    - bank debits against cash-book credits

    Signed amounts remain available for balances and reporting, but
    matching does not depend on amount inversion semantics.
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


@router.post("/match/manual/{org_id}", response_model=MatchGroupResponse)
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
            BankTransaction.is_removed.is_(False),
        ).all()
        book_txs = db.query(BookTransaction).filter(
            BookTransaction.id.in_(match_request.book_transaction_ids),
            BookTransaction.org_id == current_user.org_id,
            BookTransaction.is_removed.is_(False),
        ).all()

        if not bank_txs or not book_txs:
            raise HTTPException(status_code=400, detail="Invalid transaction IDs")
        assert_reconciliation_sessions_open(
            bank_transactions=bank_txs,
            book_transactions=book_txs,
            db=db,
        )

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
    current_user: User = Depends(get_admin_user),
):
    """Approve a pending match."""
    match_group = get_match_group_or_404(match_id, db, current_user)

    match_group.status = "approved"
    match_group.approved_at = datetime.utcnow()
    match_group.approved_by_user_id = current_user.id
    if approve_request.notes:
        match_group.notes = approve_request.notes

    bank_txs = db.query(BankTransaction).filter(
        BankTransaction.match_group_id == match_id,
        BankTransaction.org_id == current_user.org_id,
    ).all()
    book_txs = db.query(BookTransaction).filter(
        BookTransaction.match_group_id == match_id,
        BookTransaction.org_id == current_user.org_id,
    ).all()
    assert_reconciliation_sessions_open(
        bank_transactions=bank_txs,
        book_transactions=book_txs,
        db=db,
    )

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


@router.post(
    "/match/bulk-approve",
    response_model=MatchGroupBulkApproveResponse,
)
async def approve_match_bulk(
    payload: dict = Body(default_factory=dict),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Approve multiple pending matches in one request."""
    raw_ids = (
        payload.get("match_ids")
        or payload.get("matchIds")
        or payload.get("match_group_ids")
        or payload.get("matchGroupIds")
    )
    if isinstance(raw_ids, str):
        raw_ids = [raw_ids]
    if not isinstance(raw_ids, list):
        raw_ids = []

    match_ids: list[UUID] = []
    for item in raw_ids:
        try:
            match_ids.append(UUID(str(item)))
        except Exception:
            continue

    if not match_ids:
        return MatchGroupBulkApproveResponse(approved_ids=[], failed_ids=[])

    notes = payload.get("notes")

    match_groups = (
        db.query(MatchGroup)
        .filter(
            MatchGroup.id.in_(match_ids),
            MatchGroup.org_id == current_user.org_id,
        )
        .all()
    )

    approved_ids = [group.id for group in match_groups]
    failed_ids = [match_id for match_id in match_ids if match_id not in approved_ids]

    if approved_ids:
        bank_txs = (
            db.query(BankTransaction)
            .filter(
                BankTransaction.match_group_id.in_(approved_ids),
                BankTransaction.org_id == current_user.org_id,
            )
            .all()
        )
        book_txs = (
            db.query(BookTransaction)
            .filter(
                BookTransaction.match_group_id.in_(approved_ids),
                BookTransaction.org_id == current_user.org_id,
            )
            .all()
        )
        assert_reconciliation_sessions_open(
            bank_transactions=bank_txs,
            book_transactions=book_txs,
            db=db,
        )

        approved_at = datetime.utcnow()
        db.query(MatchGroup).filter(MatchGroup.id.in_(approved_ids)).update(
            {
                "status": "approved",
                "approved_at": approved_at,
                "approved_by_user_id": current_user.id,
                "notes": notes,
            },
            synchronize_session=False,
        )
        db.query(BankTransaction).filter(
            BankTransaction.match_group_id.in_(approved_ids),
            BankTransaction.org_id == current_user.org_id,
        ).update({"status": "matched"}, synchronize_session=False)
        db.query(BookTransaction).filter(
            BookTransaction.match_group_id.in_(approved_ids),
            BookTransaction.org_id == current_user.org_id,
        ).update({"status": "matched"}, synchronize_session=False)
        db.commit()

        for match_id in approved_ids:
            audit_service.log(
                db=db,
                org_id=current_user.org_id,
                actor_user_id=current_user.id,
                action="match.approved",
                entity_type="match_group",
                entity_id=str(match_id),
                metadata={"notes": notes or ""},
            )

    return MatchGroupBulkApproveResponse(
        approved_ids=approved_ids,
        failed_ids=failed_ids,
    )


@router.delete("/match/{match_id}")
async def reject_match(
    match_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Reject/delete a match."""
    match_group = get_match_group_or_404(match_id, db, current_user)

    bank_txs = db.query(BankTransaction).filter(
        BankTransaction.match_group_id == match_id,
        BankTransaction.org_id == current_user.org_id,
    ).all()
    book_txs = db.query(BookTransaction).filter(
        BookTransaction.match_group_id == match_id,
        BookTransaction.org_id == current_user.org_id,
    ).all()
    assert_reconciliation_sessions_open(
        bank_transactions=bank_txs,
        book_transactions=book_txs,
        db=db,
    )

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
    "/prepare/{org_id}/{bank_session_id}/{book_session_id}",
    response_model=ReconciliationStatusResponse,
)
async def get_reconciliation_prepare_context(
    org_id: UUID,
    bank_session_id: UUID,
    book_session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Build the worksheet/session context before matching starts."""
    get_org_or_404(org_id, db, current_user)
    get_upload_session_or_404(bank_session_id, db, current_user)
    get_upload_session_or_404(book_session_id, db, current_user)
    return processing_service.build_status_response(
        org_id=org_id,
        bank_session_id=bank_session_id,
        book_session_id=book_session_id,
        db=db,
        unmatched_suggestions=[],
    )


@router.post(
    "/manual-entry/{org_id}/{session_id}",
    response_model=ReconciliationStatusResponse,
)
async def create_manual_entry(
    org_id: UUID,
    session_id: UUID,
    payload: ManualTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Create a manual transaction directly inside a reconciliation bucket."""
    get_org_or_404(org_id, db, current_user)
    reconciliation_session = get_reconciliation_session_or_404(
        session_id,
        db,
        current_user,
    )

    if reconciliation_session.status == "closed":
        raise HTTPException(status_code=400, detail="This reconciliation month is closed.")

    amount_value = Decimal(payload.amount or 0)
    if amount_value <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero.")

    trans_date = datetime.fromisoformat(payload.trans_date)
    bucket = payload.bucket

    if bucket in {"bank_debit", "bank_credit"}:
        signed_amount = amount_value if bucket == "bank_credit" else -amount_value
        tx = BankTransaction(
            org_id=current_user.org_id,
            upload_session_id=None,
            reconciliation_session_id=reconciliation_session.id,
            trans_date=trans_date,
            narration=payload.narration,
            reference=payload.reference,
            amount=signed_amount,
            status="unreconciled",
        )
    else:
        signed_amount = amount_value if bucket == "book_debit" else -amount_value
        tx = BookTransaction(
            org_id=current_user.org_id,
            upload_session_id=None,
            reconciliation_session_id=reconciliation_session.id,
            trans_date=trans_date,
            narration=payload.narration,
            reference=payload.reference,
            amount=signed_amount,
            status="unreconciled",
        )

    db.add(tx)
    db.commit()

    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="transaction.manual_added",
        entity_type="reconciliation_session",
        entity_id=str(reconciliation_session.id),
        metadata={
            "bucket": bucket,
            "amount": str(amount_value),
        },
    )

    return processing_service.build_status_response(
        org_id=current_user.org_id,
        bank_session_id=reconciliation_session.bank_upload_session_id,
        book_session_id=reconciliation_session.book_upload_session_id,
        db=db,
        reconciliation_session=reconciliation_session,
    )


@router.post(
    "/session/{session_id}/start-blank",
    response_model=ReconciliationSessionResponse,
)
async def start_blank_period(
    session_id: UUID,
    payload: ReconciliationBlankPeriodRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Open a blank reconciliation month without carrying forward balances."""
    reference_session = get_reconciliation_session_or_404(
        session_id,
        db,
        current_user,
    )

    if not payload.period_month or len(payload.period_month) != 7:
        raise HTTPException(status_code=400, detail="Invalid period month format.")

    existing = (
        db.query(ReconciliationSession)
        .filter(
            ReconciliationSession.org_id == reference_session.org_id,
            ReconciliationSession.account_name == reference_session.account_name,
            ReconciliationSession.account_number == reference_session.account_number,
            ReconciliationSession.period_month == payload.period_month,
        )
        .first()
    )

    if existing:
        bank_session_id = existing.bank_upload_session_id
        book_session_id = existing.book_upload_session_id

        bank_filters = [BankTransaction.reconciliation_session_id == existing.id]
        if bank_session_id is not None:
            bank_filters.append(BankTransaction.upload_session_id == bank_session_id)

        book_filters = [BookTransaction.reconciliation_session_id == existing.id]
        if book_session_id is not None:
            book_filters.append(BookTransaction.upload_session_id == book_session_id)

        bank_transactions = db.query(BankTransaction).filter(or_(*bank_filters)).all()
        book_transactions = db.query(BookTransaction).filter(or_(*book_filters)).all()

        affected_match_group_ids = {
            tx.match_group_id
            for tx in [*bank_transactions, *book_transactions]
            if tx.match_group_id is not None
        }

        if bank_transactions:
            db.query(BankTransaction).filter(
                or_(*bank_filters)
            ).delete(synchronize_session=False)

        if book_transactions:
            db.query(BookTransaction).filter(
                or_(*book_filters)
            ).delete(synchronize_session=False)

        if affected_match_group_ids:
            db.query(MatchGroup).filter(
                MatchGroup.id.in_(affected_match_group_ids)
            ).delete(synchronize_session=False)

        existing.bank_upload_session_id = None
        existing.book_upload_session_id = None
        existing.bank_open_balance = 0
        existing.bank_closing_balance = 0
        existing.book_open_balance = 0
        existing.book_closing_balance = 0
        existing.bank_closing_balance_override = None
        existing.book_closing_balance_override = None
        existing.status = "open"
        existing.closed_at = None
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)

        audit_service.log(
            db=db,
            org_id=current_user.org_id,
            actor_user_id=current_user.id,
            action="reconciliation_session.blank_reopened",
            entity_type="reconciliation_session",
            entity_id=str(existing.id),
            metadata={
                "period_month": existing.period_month,
                "account_name": existing.account_name,
            },
        )
        return ReconciliationSessionResponse.model_validate(existing)

    new_session = ReconciliationSession(
        org_id=reference_session.org_id,
        account_name=reference_session.account_name,
        account_number=reference_session.account_number,
        period_month=payload.period_month,
        bank_open_balance=0,
        bank_closing_balance=0,
        book_open_balance=0,
        book_closing_balance=0,
        company_name=reference_session.company_name,
        company_address=reference_session.company_address,
        company_logo_data_url=reference_session.company_logo_data_url,
        prepared_by=reference_session.prepared_by,
        reviewed_by=reference_session.reviewed_by,
        currency_code=reference_session.currency_code,
        status="open",
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="reconciliation_session.blank_opened",
        entity_type="reconciliation_session",
        entity_id=str(new_session.id),
        metadata={
            "period_month": new_session.period_month,
            "account_name": new_session.account_name,
        },
    )

    return ReconciliationSessionResponse.model_validate(new_session)


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
    "/session/{session_id}/worksheet",
    response_model=ReconciliationStatusResponse,
)
async def get_reconciliation_session_worksheet(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Load the current worksheet for a reconciliation session, including carryforward rows."""
    reconciliation_session = get_reconciliation_session_or_404(
        session_id,
        db,
        current_user,
    )
    return processing_service.build_status_response(
        org_id=current_user.org_id,
        bank_session_id=reconciliation_session.bank_upload_session_id,
        book_session_id=reconciliation_session.book_upload_session_id,
        db=db,
        reconciliation_session=reconciliation_session,
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
        .order_by(
            ReconciliationSession.period_month.desc(),
            ReconciliationSession.account_name.asc(),
        )
        .all()
    )
    return [
        ReconciliationSessionResponse.model_validate(reconciliation_session)
        for reconciliation_session in sessions
    ]


@router.post(
    "/session/{session_id}/save",
    response_model=ReconciliationSessionResponse,
)
async def save_reconciliation_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Touch an open reconciliation session so users can intentionally save progress and resume later."""
    reconciliation_session = get_reconciliation_session_or_404(
        session_id,
        db,
        current_user,
    )
    reconciliation_session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(reconciliation_session)
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="reconciliation_session.saved",
        entity_type="reconciliation_session",
        entity_id=str(session_id),
        metadata={"period_month": reconciliation_session.period_month},
    )
    return ReconciliationSessionResponse.model_validate(reconciliation_session)


@router.post(
    "/session/{session_id}/reset",
    response_model=ReconciliationSessionResponse,
)
async def reset_reconciliation_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Clear transactions and balances so the month can be re-uploaded."""
    reconciliation_session = get_reconciliation_session_or_404(
        session_id,
        db,
        current_user,
    )
    if reconciliation_session.status == "closed":
        raise HTTPException(
            status_code=400,
            detail="This reconciliation month is closed and read-only.",
        )

    bank_session_id = reconciliation_session.bank_upload_session_id
    book_session_id = reconciliation_session.book_upload_session_id

    bank_filters = [BankTransaction.reconciliation_session_id == reconciliation_session.id]
    if bank_session_id is not None:
        bank_filters.append(BankTransaction.upload_session_id == bank_session_id)

    book_filters = [BookTransaction.reconciliation_session_id == reconciliation_session.id]
    if book_session_id is not None:
        book_filters.append(BookTransaction.upload_session_id == book_session_id)

    bank_transactions = db.query(BankTransaction).filter(or_(*bank_filters)).all()
    book_transactions = db.query(BookTransaction).filter(or_(*book_filters)).all()

    affected_match_group_ids = {
        tx.match_group_id
        for tx in [*bank_transactions, *book_transactions]
        if tx.match_group_id is not None
    }

    if bank_transactions:
        db.query(BankTransaction).filter(
            or_(*bank_filters)
        ).delete(synchronize_session=False)

    if book_transactions:
        db.query(BookTransaction).filter(
            or_(*book_filters)
        ).delete(synchronize_session=False)

    if affected_match_group_ids:
        db.query(MatchGroup).filter(
            MatchGroup.id.in_(affected_match_group_ids)
        ).delete(synchronize_session=False)

    reconciliation_session.bank_upload_session_id = None
    reconciliation_session.book_upload_session_id = None
    reconciliation_session.bank_open_balance = 0
    reconciliation_session.book_open_balance = 0
    reconciliation_session.bank_closing_balance = 0
    reconciliation_session.book_closing_balance = 0
    reconciliation_session.bank_closing_balance_override = None
    reconciliation_session.book_closing_balance_override = None
    reconciliation_session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(reconciliation_session)

    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="reconciliation_session.reset",
        entity_type="reconciliation_session",
        entity_id=str(session_id),
    )

    return ReconciliationSessionResponse.model_validate(reconciliation_session)


@router.post(
    "/session/{session_id}/close",
    response_model=ReconciliationCloseResponse,
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
    bank_transactions, book_transactions = processing_service.get_transactions_for_reconciliation_session(
        reconciliation_session,
        db,
    )
    closed_session, next_session = reconciliation_service.close_session(
        reconciliation_session,
        bank_transactions,
        book_transactions,
        db,
    )
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="reconciliation_session.closed",
        entity_type="reconciliation_session",
        entity_id=str(session_id),
        metadata={
            "period_month": closed_session.period_month,
            "next_period_month": next_session.period_month,
        },
    )
    return ReconciliationCloseResponse(
        closed_session=ReconciliationSessionResponse.model_validate(closed_session),
        next_session=ReconciliationSessionResponse.model_validate(next_session),
    )


@router.patch(
    "/session/{session_id}/balances",
    response_model=ReconciliationSessionResponse,
)
async def update_reconciliation_balances(
    session_id: UUID,
    payload: ReconciliationBalanceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Update editable opening and closing balances for a reconciliation month."""
    reconciliation_session = get_reconciliation_session_or_404(
        session_id,
        db,
        current_user,
    )
    if reconciliation_session.status == "closed":
        raise HTTPException(
            status_code=400,
            detail="This reconciliation month is closed. Balances are read-only.",
        )
    bank_transactions, book_transactions = (
        processing_service.get_transactions_for_reconciliation_session(
            reconciliation_session,
            db,
        )
    )
    updated_session = reconciliation_service.update_balances(
        reconciliation_session=reconciliation_session,
        bank_open_balance=payload.bank_open_balance,
        book_open_balance=payload.book_open_balance,
        bank_closing_balance=payload.bank_closing_balance,
        book_closing_balance=payload.book_closing_balance,
        account_number=payload.account_number,
        company_name=payload.company_name,
        company_address=payload.company_address,
        company_logo_data_url=payload.company_logo_data_url,
        prepared_by=payload.prepared_by,
        reviewed_by=payload.reviewed_by,
        currency_code=payload.currency_code,
        bank_transactions=bank_transactions,
        book_transactions=book_transactions,
        db=db,
    )
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="reconciliation_session.balances_updated",
        entity_type="reconciliation_session",
        entity_id=str(session_id),
        metadata={
            "period_month": updated_session.period_month,
            "bank_open_balance": str(payload.bank_open_balance),
            "book_open_balance": str(payload.book_open_balance),
            "bank_closing_balance": str(
                payload.bank_closing_balance
                if payload.bank_closing_balance is not None
                else updated_session.bank_closing_balance
            ),
            "book_closing_balance": str(
                payload.book_closing_balance
                if payload.book_closing_balance is not None
                else updated_session.book_closing_balance
            ),
            "account_number": payload.account_number
            if payload.account_number is not None
            else updated_session.account_number,
            "company_name": payload.company_name
            if payload.company_name is not None
            else updated_session.company_name,
            "prepared_by": payload.prepared_by
            if payload.prepared_by is not None
            else updated_session.prepared_by,
            "reviewed_by": payload.reviewed_by
            if payload.reviewed_by is not None
            else updated_session.reviewed_by,
            "currency_code": payload.currency_code
            if payload.currency_code is not None
            else updated_session.currency_code,
        },
    )
    return ReconciliationSessionResponse.model_validate(updated_session)


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


@router.post("/transactions/removal")
async def update_transaction_removal_state(
    payload: TransactionRemovalUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Exclude or restore outstanding transactions from the carryforward view."""
    bank_ids = payload.bank_transaction_ids or []
    book_ids = payload.book_transaction_ids or []
    if not bank_ids and not book_ids:
        raise HTTPException(status_code=400, detail="No transactions were selected")

    bank_transactions = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.org_id == current_user.org_id,
            BankTransaction.id.in_(bank_ids),
        )
        .all()
        if bank_ids
        else []
    )
    book_transactions = (
        db.query(BookTransaction)
        .filter(
            BookTransaction.org_id == current_user.org_id,
            BookTransaction.id.in_(book_ids),
        )
        .all()
        if book_ids
        else []
    )
    assert_reconciliation_sessions_open(
        bank_transactions=bank_transactions,
        book_transactions=book_transactions,
        db=db,
    )

    removed_at = datetime.utcnow() if payload.removed else None
    updated_bank = 0
    updated_book = 0

    for transaction in bank_transactions:
        if payload.removed and transaction.status != "unreconciled":
            continue
        transaction.is_removed = payload.removed
        transaction.removed_at = removed_at
        updated_bank += 1

    for transaction in book_transactions:
        if payload.removed and transaction.status != "unreconciled":
            continue
        transaction.is_removed = payload.removed
        transaction.removed_at = removed_at
        updated_book += 1

    db.commit()
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action=(
            "transactions.removed_from_carryforward"
            if payload.removed
            else "transactions.restored_to_carryforward"
        ),
        entity_type="transaction",
        metadata={
            "bank_transaction_count": updated_bank,
            "book_transaction_count": updated_book,
        },
    )
    return {
        "status": "success",
        "removed": payload.removed,
        "updated_bank_transactions": updated_bank,
        "updated_book_transactions": updated_book,
    }


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
    bank_upload_session = get_upload_session_or_404(bank_session_id, db, current_user)
    book_upload_session = get_upload_session_or_404(book_session_id, db, current_user)
    bank_transactions, book_transactions = processing_service.get_transactions_for_sessions(
        bank_session_id, book_session_id, db
    )
    account_name, period_month = reconciliation_service.resolve_reconciliation_context(
        bank_upload_session=bank_upload_session,
        book_upload_session=book_upload_session,
        bank_transactions=bank_transactions,
        book_transactions=book_transactions,
    )
    reconciliation_session = reconciliation_service.get_or_create_session(
        org_id=org_id,
        account_name=account_name,
        period_month=period_month,
        bank_upload_session_id=bank_session_id,
        book_upload_session_id=book_session_id,
        bank_transactions=bank_transactions,
        book_transactions=book_transactions,
        db=db,
    )
    db.commit()
    db.refresh(reconciliation_session)
    bank_transactions, book_transactions = processing_service.get_transactions_for_reconciliation_session(
        reconciliation_session,
        db,
    )
    summary = reconciliation_service.build_summary(
        reconciliation_session=reconciliation_session,
        bank_transactions=bank_transactions,
        book_transactions=book_transactions,
    )
    match_groups = processing_service.get_match_groups_for_transactions(
        bank_transactions,
        book_transactions,
        db,
    )
    csv_content = reconciliation_service.build_report_csv(
        reconciliation_session=reconciliation_session,
        summary=summary,
        bank_transactions=bank_transactions,
        book_transactions=book_transactions,
        match_groups=match_groups,
    )

    safe_account = reconciliation_session.account_name.lower().replace(" ", "-")
    filename = f"reconciliation-{safe_account}-{reconciliation_session.period_month}.csv"
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="report.downloaded",
        entity_type="reconciliation_session",
        entity_id=str(reconciliation_session.id),
        metadata={
            "period_month": reconciliation_session.period_month,
            "account_name": reconciliation_session.account_name,
        },
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
