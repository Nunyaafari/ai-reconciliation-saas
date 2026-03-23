import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import Iterable, Sequence
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.models import (
    BankTransaction,
    BookTransaction,
    MatchGroup,
    ReconciliationSession,
)
from app.schemas import (
    MatchGroupResponse,
    ReconciliationBucketSummary,
    ReconciliationSummaryResponse,
)


class ReconciliationService:
    """Session, summary, and report helpers for monthly reconciliations."""

    ZERO = Decimal("0.00")

    def _to_decimal(self, value: Decimal | float | int | None) -> Decimal:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))

    def derive_period_month(
        self,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
    ) -> str:
        dates = [
            tx.trans_date
            for tx in [*bank_transactions, *book_transactions]
            if tx.trans_date is not None
        ]
        if not dates:
            return datetime.utcnow().strftime("%Y-%m")
        return max(dates).strftime("%Y-%m")

    def get_or_create_session(
        self,
        org_id: UUID,
        bank_upload_session_id: UUID,
        book_upload_session_id: UUID,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
        db: Session,
    ) -> ReconciliationSession:
        period_month = self.derive_period_month(bank_transactions, book_transactions)

        session = (
            db.query(ReconciliationSession)
            .filter(
                ReconciliationSession.org_id == org_id,
                ReconciliationSession.period_month == period_month,
            )
            .first()
        )

        if not session:
            previous_session = (
                db.query(ReconciliationSession)
                .filter(ReconciliationSession.org_id == org_id)
                .order_by(ReconciliationSession.period_month.desc())
                .first()
            )

            bank_open_balance = (
                self._to_decimal(previous_session.bank_closing_balance)
                if previous_session
                else self.ZERO
            )
            book_open_balance = (
                self._to_decimal(previous_session.book_closing_balance)
                if previous_session
                else self.ZERO
            )

            session = ReconciliationSession(
                org_id=org_id,
                period_month=period_month,
                bank_open_balance=bank_open_balance,
                bank_closing_balance=bank_open_balance,
                book_open_balance=book_open_balance,
                book_closing_balance=book_open_balance,
                status="open",
            )
            db.add(session)
            db.flush()

        session.bank_upload_session_id = bank_upload_session_id
        session.book_upload_session_id = book_upload_session_id
        session.bank_closing_balance = self._to_decimal(session.bank_open_balance) + self._sum_signed(
            bank_transactions
        )
        session.book_closing_balance = self._to_decimal(session.book_open_balance) + self._sum_signed(
            book_transactions
        )
        session.updated_at = datetime.utcnow()

        return session

    def close_session(
        self,
        reconciliation_session: ReconciliationSession,
        db: Session,
    ) -> ReconciliationSession:
        reconciliation_session.status = "closed"
        reconciliation_session.closed_at = datetime.utcnow()
        reconciliation_session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(reconciliation_session)
        return reconciliation_session

    def reopen_session(
        self,
        reconciliation_session: ReconciliationSession,
        db: Session,
    ) -> ReconciliationSession:
        reconciliation_session.status = "open"
        reconciliation_session.closed_at = None
        reconciliation_session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(reconciliation_session)
        return reconciliation_session

    def build_summary(
        self,
        reconciliation_session: ReconciliationSession,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
    ) -> ReconciliationSummaryResponse:
        unresolved_bank = [tx for tx in bank_transactions if tx.status != "matched"]
        unresolved_book = [tx for tx in book_transactions if tx.status != "matched"]

        unresolved_bank_debits = self._bucket_summary(unresolved_bank, "debit")
        unresolved_bank_credits = self._bucket_summary(unresolved_bank, "credit")
        unresolved_book_debits = self._bucket_summary(unresolved_book, "debit")
        unresolved_book_credits = self._bucket_summary(unresolved_book, "credit")

        adjusted_bank_balance = (
            self._to_decimal(reconciliation_session.bank_closing_balance)
            + unresolved_bank_debits.total
            + unresolved_book_debits.total
        )
        adjusted_book_balance = (
            self._to_decimal(reconciliation_session.book_closing_balance)
            + unresolved_bank_credits.total
            + unresolved_book_credits.total
        )

        return ReconciliationSummaryResponse(
            period_month=reconciliation_session.period_month,
            net_bank_movement=self._sum_signed(bank_transactions),
            net_book_movement=self._sum_signed(book_transactions),
            bank_open_balance=self._to_decimal(reconciliation_session.bank_open_balance),
            bank_closing_balance=self._to_decimal(reconciliation_session.bank_closing_balance),
            book_open_balance=self._to_decimal(reconciliation_session.book_open_balance),
            book_closing_balance=self._to_decimal(reconciliation_session.book_closing_balance),
            adjusted_bank_balance=adjusted_bank_balance,
            adjusted_book_balance=adjusted_book_balance,
            difference=(adjusted_book_balance - adjusted_bank_balance).quantize(
                Decimal("0.01")
            ),
            unresolved_bank_debits=unresolved_bank_debits,
            unresolved_bank_credits=unresolved_bank_credits,
            unresolved_book_debits=unresolved_book_debits,
            unresolved_book_credits=unresolved_book_credits,
        )

    def serialize_match_group(self, match_group: MatchGroup) -> MatchGroupResponse:
        return MatchGroupResponse(
            id=match_group.id,
            org_id=match_group.org_id,
            bank_transaction_ids=[tx.id for tx in match_group.bank_transactions],
            book_transaction_ids=[tx.id for tx in match_group.book_transactions],
            match_type=match_group.match_type,
            total_bank_amount=self._to_decimal(match_group.total_bank_amount),
            total_book_amount=self._to_decimal(match_group.total_book_amount),
            variance=self._to_decimal(match_group.variance),
            confidence_score=match_group.confidence_score,
            status=match_group.status,
            notes=match_group.notes,
            created_at=match_group.created_at,
            approved_at=match_group.approved_at,
        )

    def build_report_csv(
        self,
        reconciliation_session: ReconciliationSession,
        summary: ReconciliationSummaryResponse,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
    ) -> str:
        unresolved_bank_debits = self._transactions_for_direction(bank_transactions, "debit")
        unresolved_bank_credits = self._transactions_for_direction(bank_transactions, "credit")
        unresolved_book_debits = self._transactions_for_direction(book_transactions, "debit")
        unresolved_book_credits = self._transactions_for_direction(book_transactions, "credit")

        buffer = io.StringIO()
        writer = csv.writer(buffer)

        writer.writerow(["Bank Reconciliation Statement"])
        writer.writerow(["Period", reconciliation_session.period_month])
        writer.writerow(["Status", reconciliation_session.status])
        writer.writerow([])
        writer.writerow(["Cash Book Opening Balance", self._format_money(summary.book_open_balance)])
        writer.writerow(["Cash Book Closing Balance", self._format_money(summary.book_closing_balance)])
        writer.writerow(["Bank Opening Balance", self._format_money(summary.bank_open_balance)])
        writer.writerow(["Bank Closing Balance", self._format_money(summary.bank_closing_balance)])
        writer.writerow(["Adjusted Cash Book", self._format_money(summary.adjusted_book_balance)])
        writer.writerow(["Adjusted Bank Statement", self._format_money(summary.adjusted_bank_balance)])
        writer.writerow(["Difference", self._format_money(summary.difference)])
        writer.writerow([])

        writer.writerow(
            [
                "Cash Book Credits",
                "",
                "",
                "",
                "Bank Statement Debits",
                "",
                "",
                "",
            ]
        )
        writer.writerow(
            [
                "Date",
                "Reference",
                "Narration",
                "Amount",
                "Date",
                "Reference",
                "Narration",
                "Amount",
            ]
        )
        self._write_dual_bucket_rows(
            writer,
            unresolved_book_credits,
            unresolved_bank_debits,
        )
        writer.writerow([])

        writer.writerow(
            [
                "Cash Book Debits",
                "",
                "",
                "",
                "Bank Statement Credits",
                "",
                "",
                "",
            ]
        )
        writer.writerow(
            [
                "Date",
                "Reference",
                "Narration",
                "Amount",
                "Date",
                "Reference",
                "Narration",
                "Amount",
            ]
        )
        self._write_dual_bucket_rows(
            writer,
            unresolved_book_debits,
            unresolved_bank_credits,
        )

        return buffer.getvalue()

    def _write_dual_bucket_rows(
        self,
        writer: csv.writer,
        left_transactions: Sequence[BankTransaction | BookTransaction],
        right_transactions: Sequence[BankTransaction | BookTransaction],
    ) -> None:
        max_rows = max(len(left_transactions), len(right_transactions), 1)
        for index in range(max_rows):
            left_row = self._transaction_csv_row(left_transactions[index]) if index < len(left_transactions) else ["", "", "", ""]
            right_row = self._transaction_csv_row(right_transactions[index]) if index < len(right_transactions) else ["", "", "", ""]
            writer.writerow([*left_row, *right_row])

    def _transaction_csv_row(self, transaction: BankTransaction | BookTransaction) -> list[str]:
        return [
            transaction.trans_date.strftime("%Y-%m-%d") if transaction.trans_date else "",
            transaction.reference or "",
            transaction.narration or "",
            self._format_money(getattr(transaction, f"{transaction.direction}_amount", self.ZERO)),
        ]

    def _transactions_for_direction(
        self,
        transactions: Sequence[BankTransaction | BookTransaction],
        direction: str,
    ) -> list[BankTransaction | BookTransaction]:
        filtered = [
            tx
            for tx in transactions
            if tx.status != "matched" and tx.direction == direction
        ]
        return sorted(filtered, key=lambda tx: tx.trans_date or datetime.min)

    def _sum_signed(
        self,
        transactions: Iterable[BankTransaction | BookTransaction],
    ) -> Decimal:
        total = self.ZERO
        for tx in transactions:
            total += self._to_decimal(tx.amount)
        return total.quantize(Decimal("0.01"))

    def _bucket_summary(
        self,
        transactions: Sequence[BankTransaction | BookTransaction],
        direction: str,
    ) -> ReconciliationBucketSummary:
        matching_transactions = [tx for tx in transactions if tx.direction == direction]
        total = sum(
            (self._to_decimal(getattr(tx, f"{direction}_amount", self.ZERO)) for tx in matching_transactions),
            self.ZERO,
        ).quantize(Decimal("0.01"))
        return ReconciliationBucketSummary(
            count=len(matching_transactions),
            total=total,
        )

    def _format_money(self, value: Decimal | float | int) -> str:
        return f"{self._to_decimal(value):.2f}"
