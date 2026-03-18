from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
import logging

from app.database import get_db
from app.database.models import (
    UploadSession,
    BankTransaction,
    BookTransaction,
    MatchGroup,
    Organization,
)
from app.schemas import (
    ReconciliationRequest,
    ReconciliationStatusResponse,
    MatchGroupCreate,
    MatchGroupResponse,
    MatchGroupApprove,
    UnmatchedTransactionWithSuggestions,
    MatchSuggestion,
    BankTransactionResponse,
)
from app.services.matching_service import MatchingService

router = APIRouter(prefix="/api/reconciliation", tags=["Reconciliation"])
logger = logging.getLogger(__name__)

matching_service = MatchingService()


# ===== HELPER FUNCTIONS =====

def get_org_or_404(org_id: UUID, db: Session) -> Organization:
    """Get organization or raise 404."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def get_upload_session_or_404(session_id: UUID, db: Session) -> UploadSession:
    """Get upload session or raise 404."""
    session = db.query(UploadSession).filter(UploadSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    return session


# ===== ENDPOINTS =====

@router.post("/start/{org_id}", response_model=ReconciliationStatusResponse)
async def start_reconciliation(
    org_id: UUID,
    request: ReconciliationRequest,
    db: Session = Depends(get_db),
):
    """
    Start reconciliation matching between bank and book transactions.

    1. Run matching algorithm on all transactions
    2. Calculate confidence scores
    3. Return status with unmatched items and suggestions
    """
    # Verify org and sessions exist
    org = get_org_or_404(org_id, db)
    bank_session = get_upload_session_or_404(request.bank_upload_session_id, db)
    book_session = get_upload_session_or_404(request.book_upload_session_id, db)

    try:
        # Get all transactions
        bank_transactions = db.query(BankTransaction).filter(
            BankTransaction.upload_session_id == request.bank_upload_session_id,
            BankTransaction.status == "unreconciled",
        ).all()

        book_transactions = db.query(BookTransaction).filter(
            BookTransaction.upload_session_id == request.book_upload_session_id,
            BookTransaction.status == "unreconciled",
        ).all()

        # Run matching algorithm
        matches = matching_service.match_transactions(
            bank_transactions=bank_transactions,
            book_transactions=book_transactions,
            org_id=org_id,
        )

        # Create match groups and update transaction status
        for match in matches:
            match_group = MatchGroup(
                org_id=org_id,
                match_type=match["type"],
                total_bank_amount=match["total_bank_amount"],
                total_book_amount=match["total_book_amount"],
                variance=match["variance"],
                confidence_score=match["confidence"],
                status="pending",
            )
            db.add(match_group)
            db.flush()  # Get the new ID

            # Link transactions to match group
            for bank_tx_id in match["bank_transaction_ids"]:
                tx = db.query(BankTransaction).get(bank_tx_id)
                tx.match_group_id = match_group.id
                tx.status = "pending"

            for book_tx_id in match["book_transaction_ids"]:
                tx = db.query(BookTransaction).get(book_tx_id)
                tx.match_group_id = match_group.id
                tx.status = "pending"

        db.commit()

        # Get updated statuses
        bank_matched = db.query(BankTransaction).filter(
            BankTransaction.upload_session_id == request.bank_upload_session_id,
            BankTransaction.status != "unreconciled",
        ).count()

        book_matched = db.query(BookTransaction).filter(
            BookTransaction.upload_session_id == request.book_upload_session_id,
            BookTransaction.status != "unreconciled",
        ).count()

        total_bank = len(bank_transactions)
        total_book = len(book_transactions)

        # Get unmatched transactions with suggestions
        unmatched_bank = db.query(BankTransaction).filter(
            BankTransaction.upload_session_id == request.bank_upload_session_id,
            BankTransaction.status == "unreconciled",
        ).all()

        unmatched_suggestions = []
        for bank_tx in unmatched_bank:
            suggestions = matching_service.get_suggestions_for_transaction(
                bank_tx,
                book_transactions,
            )
            unmatched_suggestions.append(
                UnmatchedTransactionWithSuggestions(
                    bank_transaction_id=bank_tx.id,
                    bank_transaction=BankTransactionResponse.from_orm(bank_tx),
                    suggestions=[
                        MatchSuggestion(
                            book_transaction_id=s["book_tx_id"],
                            confidence_score=s["confidence"],
                            match_signals=s["signals"],
                            explanation=s["explanation"],
                        )
                        for s in suggestions
                    ],
                )
            )

        # Get all match groups
        match_groups = db.query(MatchGroup).filter(
            MatchGroup.org_id == org_id
        ).all()

        progress = 0
        if total_bank + total_book > 0:
            progress = int(((bank_matched + book_matched) / (total_bank + total_book)) * 100)

        return ReconciliationStatusResponse(
            total_bank_transactions=total_bank,
            matched_bank_transactions=bank_matched,
            total_book_transactions=total_book,
            matched_book_transactions=book_matched,
            unmatched_suggestions=unmatched_suggestions,
            match_groups=[MatchGroupResponse.from_orm(mg) for mg in match_groups],
            progress_percent=progress,
        )

    except Exception as e:
        logger.error(f"Reconciliation failed for org {org_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Reconciliation failed: {str(e)}")


@router.post("/match/{org_id}", response_model=MatchGroupResponse)
async def create_manual_match(
    org_id: UUID,
    match_request: MatchGroupCreate,
    db: Session = Depends(get_db),
):
    """
    Manually create a match between transactions.
    Called when user approves an AI suggestion or creates manual link.
    """
    org = get_org_or_404(org_id, db)

    try:
        # Get transactions
        bank_txs = db.query(BankTransaction).filter(
            BankTransaction.id.in_(match_request.bank_transaction_ids)
        ).all()

        book_txs = db.query(BookTransaction).filter(
            BookTransaction.id.in_(match_request.book_transaction_ids)
        ).all()

        if not bank_txs or not book_txs:
            raise HTTPException(status_code=400, detail="Invalid transaction IDs")

        # Calculate totals and variance
        total_bank = sum(float(tx.amount) for tx in bank_txs)
        total_book = sum(float(tx.amount) for tx in book_txs)
        variance = abs(total_bank - total_book)

        # Determine match type
        match_type = f"{len(bank_txs)}:{len(book_txs)}"

        # Create match group
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

        # Link transactions
        for tx in bank_txs:
            tx.match_group_id = match_group.id
            tx.status = "pending"

        for tx in book_txs:
            tx.match_group_id = match_group.id
            tx.status = "pending"

        db.commit()
        db.refresh(match_group)

        logger.info(f"Created manual match {match_group.id} for org {org_id}")

        return MatchGroupResponse.from_orm(match_group)

    except Exception as e:
        logger.error(f"Manual match creation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Match creation failed: {str(e)}")


@router.post("/match/{match_id}/approve", response_model=MatchGroupResponse)
async def approve_match(
    match_id: UUID,
    approve_request: MatchGroupApprove,
    db: Session = Depends(get_db),
):
    """Approve a pending match."""
    match_group = db.query(MatchGroup).filter(MatchGroup.id == match_id).first()

    if not match_group:
        raise HTTPException(status_code=404, detail="Match group not found")

    from datetime import datetime
    match_group.status = "approved"
    match_group.approved_at = datetime.utcnow()
    if approve_request.notes:
        match_group.notes = approve_request.notes

    # Update linked transactions
    db.query(BankTransaction).filter(
        BankTransaction.match_group_id == match_id
    ).update({"status": "matched"})

    db.query(BookTransaction).filter(
        BookTransaction.match_group_id == match_id
    ).update({"status": "matched"})

    db.commit()
    db.refresh(match_group)

    logger.info(f"Approved match {match_id}")

    return MatchGroupResponse.from_orm(match_group)


@router.delete("/match/{match_id}")
async def reject_match(
    match_id: UUID,
    db: Session = Depends(get_db),
):
    """Reject/delete a match."""
    match_group = db.query(MatchGroup).filter(MatchGroup.id == match_id).first()

    if not match_group:
        raise HTTPException(status_code=404, detail="Match group not found")

    # Unlink transactions
    db.query(BankTransaction).filter(
        BankTransaction.match_group_id == match_id
    ).update({"match_group_id": None, "status": "unreconciled"})

    db.query(BookTransaction).filter(
        BookTransaction.match_group_id == match_id
    ).update({"match_group_id": None, "status": "unreconciled"})

    db.delete(match_group)
    db.commit()

    logger.info(f"Rejected match {match_id}")

    return {"status": "success", "match_id": str(match_id)}


@router.get("/status/{org_id}/{bank_session_id}/{book_session_id}", response_model=ReconciliationStatusResponse)
async def get_reconciliation_status(
    org_id: UUID,
    bank_session_id: UUID,
    book_session_id: UUID,
    db: Session = Depends(get_db),
):
    """Get current reconciliation status without re-running the matching algorithm."""
    org = get_org_or_404(org_id, db)

    bank_transactions = db.query(BankTransaction).filter(
        BankTransaction.upload_session_id == bank_session_id
    ).all()

    book_transactions = db.query(BookTransaction).filter(
        BookTransaction.upload_session_id == book_session_id
    ).all()

    bank_matched = sum(1 for tx in bank_transactions if tx.status == "matched")
    book_matched = sum(1 for tx in book_transactions if tx.status == "matched")

    total_bank = len(bank_transactions)
    total_book = len(book_transactions)

    progress = 0
    if total_bank + total_book > 0:
        progress = int(((bank_matched + book_matched) / (total_bank + total_book)) * 100)

    match_groups = db.query(MatchGroup).filter(
        MatchGroup.org_id == org_id
    ).all()

    return ReconciliationStatusResponse(
        total_bank_transactions=total_bank,
        matched_bank_transactions=bank_matched,
        total_book_transactions=total_book,
        matched_book_transactions=book_matched,
        unmatched_suggestions=[],
        match_groups=[MatchGroupResponse.from_orm(mg) for mg in match_groups],
        progress_percent=progress,
    )
