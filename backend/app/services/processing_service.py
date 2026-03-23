import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.models import (
    BankTransaction,
    BookTransaction,
    MatchGroup,
    Organization,
    UploadSession,
)
from app.schemas import (
    BankTransactionResponse,
    DataExtractionResponse,
    MatchSuggestion,
    ReconciliationStatusResponse,
    ReconciliationSessionResponse,
    UnmatchedTransactionWithSuggestions,
)
from app.services.extraction_service import ExtractionService
from app.services.matching_service import MatchingService
from app.services.reconciliation_service import ReconciliationService

logger = logging.getLogger(__name__)


class ProcessingService:
    """Shared processing logic used by sync routes and async jobs."""

    def __init__(self) -> None:
        self.extraction_service = ExtractionService()
        self.matching_service = MatchingService()
        self.reconciliation_service = ReconciliationService()

    def build_extraction_preview(
        self,
        session: UploadSession,
        file_content: bytes,
        db: Session,
    ) -> DataExtractionResponse:
        """Extract raw data and build the preview payload used by mapping."""
        session.status = "extracting"
        session.error_message = None
        db.commit()

        try:
            extraction_result = self.extraction_service.extract(
                file_content=file_content,
                file_type=session.file_type,
                org_id=session.org_id,
            )

            if not extraction_result.get("raw_data") and not extraction_result.get(
                "column_headers"
            ):
                raise ValueError(
                    "No rows detected. Please upload a clearer file or use CSV/XLSX."
                )

            ai_mapping = self.extraction_service.guess_column_mapping(
                raw_data=extraction_result["raw_data"],
                org_id=session.org_id,
                column_headers=extraction_result.get("column_headers", []),
            )

            session.status = "mapping"
            session.rows_extracted = len(extraction_result["raw_data"])
            session.error_message = None
            db.commit()

            return DataExtractionResponse(
                extraction_id=str(session.id),
                raw_data=extraction_result["raw_data"][:5],
                column_headers=extraction_result["column_headers"],
                ai_guess_mapping=ai_mapping,
                ai_confidence=extraction_result.get("confidence", 75),
                extraction_method=extraction_result.get("method", "unknown"),
            )
        except Exception as exc:
            session.status = "failed"
            session.error_message = str(exc)
            db.commit()
            logger.error("Extraction failed for session %s: %s", session.id, exc)
            raise

    def run_reconciliation(
        self,
        org_id: UUID,
        bank_session_id: UUID,
        book_session_id: UUID,
        db: Session,
    ) -> ReconciliationStatusResponse:
        """Run the matching engine and return the hydrated reconciliation status."""
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ValueError("Organization not found")

        bank_session = db.query(UploadSession).filter(
            UploadSession.id == bank_session_id
        ).first()
        if not bank_session:
            raise ValueError("Bank upload session not found")

        book_session = db.query(UploadSession).filter(
            UploadSession.id == book_session_id
        ).first()
        if not book_session:
            raise ValueError("Book upload session not found")

        bank_transactions = (
            db.query(BankTransaction)
            .filter(
                BankTransaction.upload_session_id == bank_session_id,
                BankTransaction.status == "unreconciled",
            )
            .all()
        )

        book_transactions = (
            db.query(BookTransaction)
            .filter(
                BookTransaction.upload_session_id == book_session_id,
                BookTransaction.status == "unreconciled",
            )
            .all()
        )

        matches = self.matching_service.match_transactions(
            bank_transactions=bank_transactions,
            book_transactions=book_transactions,
            org_id=str(org_id),
        )

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
            db.flush()

            for bank_tx_id in match["bank_transaction_ids"]:
                tx = db.get(BankTransaction, bank_tx_id)
                if tx:
                    tx.match_group_id = match_group.id
                    tx.status = "pending"

            for book_tx_id in match["book_transaction_ids"]:
                tx = db.get(BookTransaction, book_tx_id)
                if tx:
                    tx.match_group_id = match_group.id
                    tx.status = "pending"

        db.commit()

        unmatched_book = (
            db.query(BookTransaction)
            .filter(
                BookTransaction.upload_session_id == book_session_id,
                BookTransaction.status == "unreconciled",
            )
            .all()
        )
        unmatched_bank = (
            db.query(BankTransaction)
            .filter(
                BankTransaction.upload_session_id == bank_session_id,
                BankTransaction.status == "unreconciled",
            )
            .all()
        )

        unmatched_suggestions = []
        for bank_tx in unmatched_bank:
            suggestions = self.matching_service.get_suggestions_for_transaction(
                bank_tx,
                unmatched_book,
            )
            unmatched_suggestions.append(
                UnmatchedTransactionWithSuggestions(
                    bank_transaction_id=bank_tx.id,
                    bank_transaction=BankTransactionResponse.model_validate(bank_tx),
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

        return self.build_status_response(
            org_id=org_id,
            bank_session_id=bank_session_id,
            book_session_id=book_session_id,
            db=db,
            unmatched_suggestions=unmatched_suggestions,
        )

    def get_transactions_for_sessions(
        self,
        bank_session_id: UUID,
        book_session_id: UUID,
        db: Session,
    ) -> tuple[list[BankTransaction], list[BookTransaction]]:
        bank_transactions = (
            db.query(BankTransaction)
            .filter(BankTransaction.upload_session_id == bank_session_id)
            .order_by(BankTransaction.trans_date.asc(), BankTransaction.created_at.asc())
            .all()
        )
        book_transactions = (
            db.query(BookTransaction)
            .filter(BookTransaction.upload_session_id == book_session_id)
            .order_by(BookTransaction.trans_date.asc(), BookTransaction.created_at.asc())
            .all()
        )
        return bank_transactions, book_transactions

    def get_match_groups_for_transactions(
        self,
        bank_transactions: list[BankTransaction],
        book_transactions: list[BookTransaction],
        db: Session,
    ) -> list[MatchGroup]:
        match_group_ids = {
            tx.match_group_id
            for tx in [*bank_transactions, *book_transactions]
            if tx.match_group_id is not None
        }
        if not match_group_ids:
            return []
        return (
            db.query(MatchGroup)
            .filter(MatchGroup.id.in_(match_group_ids))
            .order_by(MatchGroup.created_at.desc())
            .all()
        )

    def build_status_response(
        self,
        org_id: UUID,
        bank_session_id: UUID,
        book_session_id: UUID,
        db: Session,
        unmatched_suggestions: list[UnmatchedTransactionWithSuggestions] | None = None,
    ) -> ReconciliationStatusResponse:
        bank_transactions, book_transactions = self.get_transactions_for_sessions(
            bank_session_id,
            book_session_id,
            db,
        )

        bank_matched = sum(1 for tx in bank_transactions if tx.status == "matched")
        book_matched = sum(1 for tx in book_transactions if tx.status == "matched")
        total_bank = len(bank_transactions)
        total_book = len(book_transactions)
        progress = (
            int(((bank_matched + book_matched) / (total_bank + total_book)) * 100)
            if total_bank + total_book > 0
            else 0
        )

        reconciliation_session = self.reconciliation_service.get_or_create_session(
            org_id=org_id,
            bank_upload_session_id=bank_session_id,
            book_upload_session_id=book_session_id,
            bank_transactions=bank_transactions,
            book_transactions=book_transactions,
            db=db,
        )
        db.commit()
        db.refresh(reconciliation_session)

        summary = self.reconciliation_service.build_summary(
            reconciliation_session=reconciliation_session,
            bank_transactions=bank_transactions,
            book_transactions=book_transactions,
        )
        match_groups = self.get_match_groups_for_transactions(
            bank_transactions,
            book_transactions,
            db,
        )

        return ReconciliationStatusResponse(
            total_bank_transactions=total_bank,
            matched_bank_transactions=bank_matched,
            total_book_transactions=total_book,
            matched_book_transactions=book_matched,
            unmatched_suggestions=unmatched_suggestions or [],
            match_groups=[
                self.reconciliation_service.serialize_match_group(match_group)
                for match_group in match_groups
            ],
            progress_percent=progress,
            reconciliation_session=ReconciliationSessionResponse.model_validate(
                reconciliation_session
            ),
            summary=summary,
        )
