import logging
import time
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.models import (
    BankTransaction,
    BookTransaction,
    MatchGroup,
    Organization,
    ReconciliationSession,
    UploadSession,
)
from app.schemas import (
    BankTransactionResponse,
    BookTransactionResponse,
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
            started_at = time.perf_counter()
            extraction_result = self.extraction_service.extract(
                file_content=file_content,
                file_type=session.file_type,
                org_id=session.org_id,
                preview_mode=True,
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
                upload_source=session.upload_source,
            )
            preview_metrics = self.extraction_service.build_preview_metrics(
                raw_data=extraction_result["raw_data"],
                column_headers=extraction_result.get("column_headers", []),
            )

            session.status = "mapping"
            session.rows_extracted = len(extraction_result["raw_data"])
            session.error_message = None
            db.commit()

            elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)
            logger.info(
                "Built extraction preview for session %s in %sms using %s",
                session.id,
                elapsed_ms,
                extraction_result.get("method", "unknown"),
            )

            return DataExtractionResponse(
                extraction_id=str(session.id),
                raw_data=extraction_result["raw_data"][:5],
                column_headers=extraction_result["column_headers"],
                ai_guess_mapping=ai_mapping,
                ai_confidence=extraction_result.get("confidence", 75),
                extraction_method=extraction_result.get("method", "unknown"),
                total_rows=preview_metrics["total_rows"],
                column_metrics=preview_metrics["column_metrics"],
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

        account_name, period_month = self.reconciliation_service.resolve_reconciliation_context(
            bank_upload_session=bank_session,
            book_upload_session=book_session,
            bank_transactions=[],
            book_transactions=[],
        )

        bank_upload_transactions = (
            db.query(BankTransaction)
            .filter(
                BankTransaction.upload_session_id == bank_session_id,
            )
            .all()
        )

        book_upload_transactions = (
            db.query(BookTransaction)
            .filter(
                BookTransaction.upload_session_id == book_session_id,
            )
            .all()
        )

        reconciliation_session = self.reconciliation_service.get_or_create_session(
            org_id=org_id,
            account_name=account_name,
            period_month=period_month,
            bank_upload_session_id=bank_session_id,
            book_upload_session_id=book_session_id,
            bank_transactions=bank_upload_transactions,
            book_transactions=book_upload_transactions,
            db=db,
        )
        self._attach_transactions_to_reconciliation_session(
            reconciliation_session=reconciliation_session,
            bank_transactions=bank_upload_transactions,
            book_transactions=book_upload_transactions,
        )
        db.commit()
        db.refresh(reconciliation_session)

        bank_transactions, book_transactions = self.get_transactions_for_reconciliation_session(
            reconciliation_session,
            db,
        )

        bank_transactions = [
            tx
            for tx in bank_transactions
            if tx.status == "unreconciled" and not tx.is_removed
        ]
        book_transactions = [
            tx
            for tx in book_transactions
            if tx.status == "unreconciled" and not tx.is_removed
        ]

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

        unmatched_book = [
            tx for tx in book_transactions if tx.status == "unreconciled" and not tx.is_removed
        ]
        unmatched_bank = [
            tx for tx in bank_transactions if tx.status == "unreconciled" and not tx.is_removed
        ]

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
            reconciliation_session=reconciliation_session,
        )

    def _attach_transactions_to_reconciliation_session(
        self,
        reconciliation_session: ReconciliationSession,
        bank_transactions: list[BankTransaction],
        book_transactions: list[BookTransaction],
    ) -> None:
        for transaction in bank_transactions:
            if transaction.reconciliation_session_id != reconciliation_session.id:
                transaction.reconciliation_session_id = reconciliation_session.id

        for transaction in book_transactions:
            if transaction.reconciliation_session_id != reconciliation_session.id:
                transaction.reconciliation_session_id = reconciliation_session.id

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

    def get_transactions_for_reconciliation_session(
        self,
        reconciliation_session: ReconciliationSession,
        db: Session,
    ) -> tuple[list[BankTransaction], list[BookTransaction]]:
        bank_query = db.query(BankTransaction).filter(
            BankTransaction.org_id == reconciliation_session.org_id
        )
        if reconciliation_session.bank_upload_session_id:
            bank_query = bank_query.filter(
                (BankTransaction.upload_session_id == reconciliation_session.bank_upload_session_id)
                | (BankTransaction.reconciliation_session_id == reconciliation_session.id)
            )
        else:
            bank_query = bank_query.filter(
                BankTransaction.reconciliation_session_id == reconciliation_session.id
            )

        book_query = db.query(BookTransaction).filter(
            BookTransaction.org_id == reconciliation_session.org_id
        )
        if reconciliation_session.book_upload_session_id:
            book_query = book_query.filter(
                (BookTransaction.upload_session_id == reconciliation_session.book_upload_session_id)
                | (BookTransaction.reconciliation_session_id == reconciliation_session.id)
            )
        else:
            book_query = book_query.filter(
                BookTransaction.reconciliation_session_id == reconciliation_session.id
            )

        bank_transactions = bank_query.order_by(
            BankTransaction.trans_date.asc(),
            BankTransaction.created_at.asc(),
        ).all()
        book_transactions = book_query.order_by(
            BookTransaction.trans_date.asc(),
            BookTransaction.created_at.asc(),
        ).all()
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
        bank_session_id: UUID | None,
        book_session_id: UUID | None,
        db: Session,
        unmatched_suggestions: list[UnmatchedTransactionWithSuggestions] | None = None,
        reconciliation_session: ReconciliationSession | None = None,
    ) -> ReconciliationStatusResponse:
        if reconciliation_session is None:
            if bank_session_id is None or book_session_id is None:
                raise ValueError("Upload session context could not be resolved")

            bank_transactions, book_transactions = self.get_transactions_for_sessions(
                bank_session_id,
                book_session_id,
                db,
            )

            bank_session = db.query(UploadSession).filter(
                UploadSession.id == bank_session_id
            ).first()
            book_session = db.query(UploadSession).filter(
                UploadSession.id == book_session_id
            ).first()
            if not bank_session or not book_session:
                raise ValueError("Upload session context could not be resolved")

            account_name, period_month = self.reconciliation_service.resolve_reconciliation_context(
                bank_upload_session=bank_session,
                book_upload_session=book_session,
                bank_transactions=bank_transactions,
                book_transactions=book_transactions,
            )

            reconciliation_session = self.reconciliation_service.get_or_create_session(
                org_id=org_id,
                account_name=account_name,
                period_month=period_month,
                bank_upload_session_id=bank_session_id,
                book_upload_session_id=book_session_id,
                bank_transactions=bank_transactions,
                book_transactions=book_transactions,
                db=db,
            )
            self._attach_transactions_to_reconciliation_session(
                reconciliation_session=reconciliation_session,
                bank_transactions=bank_transactions,
                book_transactions=book_transactions,
            )
            db.commit()
            db.refresh(reconciliation_session)

        bank_transactions, book_transactions = self.get_transactions_for_reconciliation_session(
            reconciliation_session,
            db,
        )

        active_bank_transactions = [
            tx for tx in bank_transactions if not getattr(tx, "is_removed", False)
        ]
        active_book_transactions = [
            tx for tx in book_transactions if not getattr(tx, "is_removed", False)
        ]

        bank_matched = sum(1 for tx in active_bank_transactions if tx.status == "matched")
        book_matched = sum(1 for tx in active_book_transactions if tx.status == "matched")
        total_bank = len(active_bank_transactions)
        total_book = len(active_book_transactions)
        progress = (
            int(((bank_matched + book_matched) / (total_bank + total_book)) * 100)
            if total_bank + total_book > 0
            else 0
        )

        if unmatched_suggestions is None:
            unmatched_bank = [
                tx for tx in active_bank_transactions if tx.status == "unreconciled"
            ]
            unmatched_book = [
                tx for tx in active_book_transactions if tx.status == "unreconciled"
            ]
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
            bank_transactions=[
                BankTransactionResponse.model_validate(tx) for tx in bank_transactions
            ],
            book_transactions=[
                BookTransactionResponse.model_validate(tx) for tx in book_transactions
            ],
        )
