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
    Organization,
    ReconciliationSession,
    UploadSession,
)
from app.schemas import (
    MatchGroupResponse,
    ReconciliationBucketSummary,
    ReconciliationSummaryResponse,
)


class ReconciliationService:
    """Session, summary, and report helpers for monthly reconciliations."""

    ZERO = Decimal("0.00")

    def _normalize_currency_code(self, value: str | None) -> str:
        code = (value or "GHS").strip().upper()
        if code == "GHC":
            code = "GHS"
        return code or "GHS"

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

    def resolve_reconciliation_context(
        self,
        bank_upload_session: UploadSession,
        book_upload_session: UploadSession,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
    ) -> tuple[str, str]:
        bank_account_name = (bank_upload_session.account_name or "").strip()
        book_account_name = (book_upload_session.account_name or "").strip()
        bank_period_month = (bank_upload_session.period_month or "").strip()
        book_period_month = (book_upload_session.period_month or "").strip()

        account_name = bank_account_name or book_account_name or "Default Account"
        period_month = (
            bank_period_month
            or book_period_month
            or self.derive_period_month(bank_transactions, book_transactions)
        )

        if bank_account_name and book_account_name and bank_account_name != book_account_name:
            raise ValueError("Bank statement and cash book must belong to the same account")
        if bank_period_month and book_period_month and bank_period_month != book_period_month:
            raise ValueError("Bank statement and cash book must belong to the same recon month")

        return account_name, period_month

    def get_or_create_session(
        self,
        org_id: UUID,
        account_name: str,
        period_month: str,
        bank_upload_session_id: UUID,
        book_upload_session_id: UUID,
        account_number: str | None,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
        db: Session,
    ) -> ReconciliationSession:
        normalized_account_number = (account_number or "").strip() or None
        organization = db.query(Organization).filter(Organization.id == org_id).first()

        # Prefer an exact session already bound to this upload pair.
        session = (
            db.query(ReconciliationSession)
            .filter(
                ReconciliationSession.org_id == org_id,
                ReconciliationSession.bank_upload_session_id == bank_upload_session_id,
                ReconciliationSession.book_upload_session_id == book_upload_session_id,
            )
            .first()
        )

        # Otherwise resolve by account-period (account number scoped when provided).
        if not session:
            lookup_query = db.query(ReconciliationSession).filter(
                ReconciliationSession.org_id == org_id,
                ReconciliationSession.account_name == account_name,
                ReconciliationSession.period_month == period_month,
            )
            if normalized_account_number is not None:
                lookup_query = lookup_query.filter(
                    ReconciliationSession.account_number == normalized_account_number
                )
            session = lookup_query.first()

        # Backward-compatible fallback for historical rows without account numbers.
        if not session:
            session = (
                db.query(ReconciliationSession)
                .filter(
                    ReconciliationSession.org_id == org_id,
                    ReconciliationSession.account_name == account_name,
                    ReconciliationSession.period_month == period_month,
                )
                .first()
            )

        if not session:
            previous_query = db.query(ReconciliationSession).filter(
                ReconciliationSession.org_id == org_id,
                ReconciliationSession.account_name == account_name,
                ReconciliationSession.period_month < period_month,
            )
            if normalized_account_number is not None:
                previous_query = previous_query.filter(
                    ReconciliationSession.account_number == normalized_account_number
                )

            previous_session = (
                previous_query.order_by(ReconciliationSession.period_month.desc()).first()
            )

            bank_open_balance = (
                self._effective_bank_closing_balance(previous_session)
                if previous_session
                else self.ZERO
            )
            book_open_balance = (
                self._effective_book_closing_balance(previous_session)
                if previous_session
                else self.ZERO
            )

            session = ReconciliationSession(
                org_id=org_id,
                account_name=account_name,
                account_number=normalized_account_number,
                period_month=period_month,
                bank_open_balance=bank_open_balance,
                bank_closing_balance=bank_open_balance,
                book_open_balance=book_open_balance,
                book_closing_balance=book_open_balance,
                company_name=(
                    previous_session.company_name
                    if previous_session and previous_session.company_name
                    else (organization.name if organization else None)
                ),
                company_address=(
                    previous_session.company_address
                    if previous_session and previous_session.company_address
                    else (organization.company_address if organization else None)
                ),
                company_logo_data_url=(
                    previous_session.company_logo_data_url
                    if previous_session and previous_session.company_logo_data_url
                    else (organization.company_logo_data_url if organization else None)
                ),
                prepared_by=previous_session.prepared_by if previous_session else None,
                reviewed_by=previous_session.reviewed_by if previous_session else None,
                currency_code=self._normalize_currency_code(
                    previous_session.currency_code if previous_session else "GHS"
                ),
                status="open",
            )
            db.add(session)
            db.flush()
        else:
            if organization:
                session.company_name = session.company_name or organization.name
                session.company_address = (
                    session.company_address or organization.company_address
                )
                session.company_logo_data_url = (
                    session.company_logo_data_url or organization.company_logo_data_url
                )
            session.currency_code = self._normalize_currency_code(
                session.currency_code
            )

        session.bank_upload_session_id = bank_upload_session_id
        session.book_upload_session_id = book_upload_session_id
        session.account_name = account_name
        if normalized_account_number is not None:
            session.account_number = normalized_account_number
        self._recalculate_closing_balances(session, bank_transactions, book_transactions)
        session.updated_at = datetime.utcnow()

        return session

    def next_period_month(self, period_month: str) -> str:
        year, month = period_month.split("-")
        year_num = int(year)
        month_num = int(month)
        if month_num == 12:
            return f"{year_num + 1}-01"
        return f"{year_num}-{month_num + 1:02d}"

    def update_balances(
        self,
        reconciliation_session: ReconciliationSession,
        bank_open_balance: Decimal | float | int,
        book_open_balance: Decimal | float | int,
        bank_closing_balance: Decimal | float | int | None,
        book_closing_balance: Decimal | float | int | None,
        account_number: str | None,
        company_name: str | None,
        company_address: str | None,
        company_logo_data_url: str | None,
        prepared_by: str | None,
        reviewed_by: str | None,
        currency_code: str | None,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
        db: Session,
    ) -> ReconciliationSession:
        reconciliation_session.bank_open_balance = self._to_decimal(bank_open_balance)
        reconciliation_session.book_open_balance = self._to_decimal(book_open_balance)
        if bank_closing_balance is not None:
            reconciliation_session.bank_closing_balance_override = self._to_decimal(
                bank_closing_balance
            )
        if book_closing_balance is not None:
            reconciliation_session.book_closing_balance_override = self._to_decimal(
                book_closing_balance
            )
        if account_number is not None:
            reconciliation_session.account_number = account_number.strip() or None
        if company_name is not None:
            reconciliation_session.company_name = company_name.strip() or None
        if company_address is not None:
            reconciliation_session.company_address = company_address.strip() or None
        if company_logo_data_url is not None:
            reconciliation_session.company_logo_data_url = (
                company_logo_data_url.strip() or None
            )
        if prepared_by is not None:
            reconciliation_session.prepared_by = prepared_by.strip() or None
        if reviewed_by is not None:
            reconciliation_session.reviewed_by = reviewed_by.strip() or None
        if currency_code is not None:
            reconciliation_session.currency_code = self._normalize_currency_code(
                currency_code
            )
        self._recalculate_closing_balances(
            reconciliation_session,
            bank_transactions,
            book_transactions,
        )
        reconciliation_session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(reconciliation_session)
        return reconciliation_session

    def close_session(
        self,
        reconciliation_session: ReconciliationSession,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
        db: Session,
    ) -> tuple[ReconciliationSession, ReconciliationSession]:
        reconciliation_session.status = "closed"
        reconciliation_session.closed_at = datetime.utcnow()
        reconciliation_session.updated_at = datetime.utcnow()
        next_session = self._build_next_session_with_carryforward(
            reconciliation_session=reconciliation_session,
            bank_transactions=bank_transactions,
            book_transactions=book_transactions,
            db=db,
        )
        db.commit()
        db.refresh(reconciliation_session)
        db.refresh(next_session)
        return reconciliation_session, next_session

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
        unresolved_bank = self._active_unresolved_transactions(bank_transactions)
        unresolved_book = self._active_unresolved_transactions(book_transactions)
        movement_bank_transactions = self._movement_transactions(bank_transactions)
        movement_book_transactions = self._movement_transactions(book_transactions)

        unresolved_bank_debits = self._bucket_summary(unresolved_bank, "debit")
        unresolved_bank_credits = self._bucket_summary(unresolved_bank, "credit")
        unresolved_book_debits = self._bucket_summary(unresolved_book, "debit")
        unresolved_book_credits = self._bucket_summary(unresolved_book, "credit")
        lane_one_difference = (
            unresolved_book_credits.total - unresolved_bank_debits.total
        ).quantize(Decimal("0.01"))
        lane_two_difference = (
            unresolved_bank_credits.total - unresolved_book_debits.total
        ).quantize(Decimal("0.01"))

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
            net_bank_movement=self._sum_signed(movement_bank_transactions),
            net_book_movement=self._sum_signed(movement_book_transactions),
            bank_open_balance=self._to_decimal(reconciliation_session.bank_open_balance),
            bank_closing_balance=self._to_decimal(reconciliation_session.bank_closing_balance),
            book_open_balance=self._to_decimal(reconciliation_session.book_open_balance),
            book_closing_balance=self._to_decimal(reconciliation_session.book_closing_balance),
            bank_debit_subtotal=unresolved_bank_debits.total,
            bank_credit_subtotal=unresolved_bank_credits.total,
            book_debit_subtotal=unresolved_book_debits.total,
            book_credit_subtotal=unresolved_book_credits.total,
            lane_one_difference=lane_one_difference,
            lane_two_difference=lane_two_difference,
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
        match_groups: Sequence[MatchGroup],
    ) -> str:
        unresolved_bank_debits = self._transactions_for_direction(bank_transactions, "debit")
        unresolved_bank_credits = self._transactions_for_direction(bank_transactions, "credit")
        unresolved_book_debits = self._transactions_for_direction(book_transactions, "debit")
        unresolved_book_credits = self._transactions_for_direction(book_transactions, "credit")

        buffer = io.StringIO()
        writer = csv.writer(buffer)

        writer.writerow(["BANK RECONCILIATION STATEMENT"])
        writer.writerow(
            [
                "Account",
                reconciliation_session.account_name,
                "",
                "",
                "",
                "Period",
                reconciliation_session.period_month,
            ]
        )
        writer.writerow(
            [
                "Status",
                reconciliation_session.status,
                "",
                "",
                "",
                "Generated At",
                datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            ]
        )
        writer.writerow([])
        writer.writerow(
            [
                "BAL. AS PER CASH BOOK",
                self._format_money(summary.book_closing_balance),
                "",
                "",
                "",
                "BAL. AS PER BANK STATEMENT",
                self._format_money(summary.bank_closing_balance),
            ]
        )
        writer.writerow([])
        self._write_bucket_section(
            writer=writer,
            title="Bank Credits / Cash Book Debits",
            subtitle="Outstanding rows only. Approved matches are removed entirely from this statement.",
            left_label="Bank Credits",
            right_label="Cash Book Debits",
            left_direction="credit",
            right_direction="debit",
            left_transactions=unresolved_bank_credits,
            right_transactions=unresolved_book_debits,
        )
        writer.writerow([])
        self._write_bucket_section(
            writer=writer,
            title="Cash Book Credits / Bank Debits",
            subtitle="Outstanding rows only. Approved matches are removed entirely from this statement.",
            left_label="Cash Book Credits",
            right_label="Bank Debits",
            left_direction="credit",
            right_direction="debit",
            left_transactions=unresolved_book_credits,
            right_transactions=unresolved_bank_debits,
        )
        writer.writerow([])
        writer.writerow(
            [
                "TOTAL - Adjusted Cash Book",
                self._format_money(summary.adjusted_book_balance),
                "",
                "",
                "",
                "TOTAL - Adjusted Bank Statement",
                self._format_money(summary.adjusted_bank_balance),
                "",
                "",
                "",
                "Difference",
                self._format_money(summary.difference),
            ]
        )

        return buffer.getvalue()

    def _recalculate_closing_balances(
        self,
        reconciliation_session: ReconciliationSession,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
    ) -> None:
        computed_bank_closing = self._to_decimal(
            reconciliation_session.bank_open_balance
        ) + self._sum_signed(self._movement_transactions(bank_transactions))
        computed_book_closing = self._to_decimal(
            reconciliation_session.book_open_balance
        ) + self._sum_signed(self._movement_transactions(book_transactions))
        reconciliation_session.bank_closing_balance = (
            self._to_decimal(reconciliation_session.bank_closing_balance_override)
            if reconciliation_session.bank_closing_balance_override is not None
            else computed_bank_closing
        )
        reconciliation_session.book_closing_balance = (
            self._to_decimal(reconciliation_session.book_closing_balance_override)
            if reconciliation_session.book_closing_balance_override is not None
            else computed_book_closing
        )

    def _effective_bank_closing_balance(
        self,
        reconciliation_session: ReconciliationSession,
    ) -> Decimal:
        if reconciliation_session.bank_closing_balance_override is not None:
            return self._to_decimal(reconciliation_session.bank_closing_balance_override)
        return self._to_decimal(reconciliation_session.bank_closing_balance)

    def _effective_book_closing_balance(
        self,
        reconciliation_session: ReconciliationSession,
    ) -> Decimal:
        if reconciliation_session.book_closing_balance_override is not None:
            return self._to_decimal(reconciliation_session.book_closing_balance_override)
        return self._to_decimal(reconciliation_session.book_closing_balance)

    def _movement_transactions(
        self,
        transactions: Sequence[BankTransaction | BookTransaction],
    ) -> list[BankTransaction | BookTransaction]:
        return [tx for tx in transactions if not getattr(tx, "is_carryforward", False)]

    def _build_next_session_with_carryforward(
        self,
        reconciliation_session: ReconciliationSession,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
        db: Session,
    ) -> ReconciliationSession:
        next_period_month = self.next_period_month(reconciliation_session.period_month)
        next_query = db.query(ReconciliationSession).filter(
            ReconciliationSession.org_id == reconciliation_session.org_id,
            ReconciliationSession.account_name == reconciliation_session.account_name,
            ReconciliationSession.period_month == next_period_month,
        )
        if reconciliation_session.account_number is not None:
            next_query = next_query.filter(
                ReconciliationSession.account_number == reconciliation_session.account_number
            )
        next_session = next_query.first()

        # Backward-compatible fallback for historical rows without account numbers.
        if not next_session:
            next_session = (
                db.query(ReconciliationSession)
                .filter(
                    ReconciliationSession.org_id == reconciliation_session.org_id,
                    ReconciliationSession.account_name == reconciliation_session.account_name,
                    ReconciliationSession.period_month == next_period_month,
                )
                .first()
            )

        if not next_session:
            next_session = ReconciliationSession(
                org_id=reconciliation_session.org_id,
                account_name=reconciliation_session.account_name,
                account_number=reconciliation_session.account_number,
                period_month=next_period_month,
                bank_open_balance=self._to_decimal(
                    self._effective_bank_closing_balance(reconciliation_session)
                ),
                bank_closing_balance=self._to_decimal(
                    self._effective_bank_closing_balance(reconciliation_session)
                ),
                book_open_balance=self._to_decimal(
                    self._effective_book_closing_balance(reconciliation_session)
                ),
                book_closing_balance=self._to_decimal(
                    self._effective_book_closing_balance(reconciliation_session)
                ),
                company_name=reconciliation_session.company_name,
                company_address=reconciliation_session.company_address,
                company_logo_data_url=reconciliation_session.company_logo_data_url,
                prepared_by=reconciliation_session.prepared_by,
                reviewed_by=reconciliation_session.reviewed_by,
                currency_code=self._normalize_currency_code(
                    reconciliation_session.currency_code
                ),
                status="open",
            )
            db.add(next_session)
            db.flush()
        else:
            next_session.bank_open_balance = self._to_decimal(
                self._effective_bank_closing_balance(reconciliation_session)
            )
            next_session.bank_closing_balance = self._to_decimal(
                self._effective_bank_closing_balance(reconciliation_session)
            )
            next_session.bank_closing_balance_override = None
            next_session.book_open_balance = self._to_decimal(
                self._effective_book_closing_balance(reconciliation_session)
            )
            next_session.book_closing_balance = self._to_decimal(
                self._effective_book_closing_balance(reconciliation_session)
            )
            next_session.book_closing_balance_override = None
            next_session.account_number = reconciliation_session.account_number
            next_session.company_name = reconciliation_session.company_name
            next_session.company_address = reconciliation_session.company_address
            next_session.company_logo_data_url = reconciliation_session.company_logo_data_url
            next_session.prepared_by = reconciliation_session.prepared_by
            next_session.reviewed_by = reconciliation_session.reviewed_by
            next_session.currency_code = self._normalize_currency_code(
                reconciliation_session.currency_code
            )
            next_session.updated_at = datetime.utcnow()

        # Carryforward month should start without upload sessions attached.
        next_session.bank_upload_session_id = None
        next_session.book_upload_session_id = None

        self._replace_carryforward_transactions(
            next_session=next_session,
            bank_transactions=self._active_unresolved_transactions(bank_transactions),
            book_transactions=self._active_unresolved_transactions(book_transactions),
            db=db,
        )

        return next_session

    def _replace_carryforward_transactions(
        self,
        next_session: ReconciliationSession,
        bank_transactions: Sequence[BankTransaction],
        book_transactions: Sequence[BookTransaction],
        db: Session,
    ) -> None:
        db.query(BankTransaction).filter(
            BankTransaction.reconciliation_session_id == next_session.id,
            BankTransaction.is_carryforward.is_(True),
        ).delete(synchronize_session=False)
        db.query(BookTransaction).filter(
            BookTransaction.reconciliation_session_id == next_session.id,
            BookTransaction.is_carryforward.is_(True),
        ).delete(synchronize_session=False)

        for transaction in bank_transactions:
            db.add(
                BankTransaction(
                    org_id=transaction.org_id,
                    reconciliation_session_id=next_session.id,
                    trans_date=transaction.trans_date,
                    narration=transaction.narration,
                    reference=transaction.reference,
                    amount=transaction.amount,
                    status="unreconciled",
                    is_removed=False,
                    removed_at=None,
                    is_carryforward=True,
                )
            )

        for transaction in book_transactions:
            db.add(
                BookTransaction(
                    org_id=transaction.org_id,
                    reconciliation_session_id=next_session.id,
                    trans_date=transaction.trans_date,
                    narration=transaction.narration,
                    reference=transaction.reference,
                    amount=transaction.amount,
                    status="unreconciled",
                    is_removed=False,
                    removed_at=None,
                    is_carryforward=True,
                )
            )

    def _write_dual_bucket_rows(
        self,
        writer: csv.writer,
        left_transactions: Sequence[BankTransaction | BookTransaction],
        right_transactions: Sequence[BankTransaction | BookTransaction],
    ) -> None:
        max_rows = max(len(left_transactions), len(right_transactions), 1)
        for index in range(max_rows):
            left_row = (
                self._transaction_csv_row(left_transactions[index])
                if index < len(left_transactions)
                else ["", "", "", "", ""]
            )
            right_row = (
                self._transaction_csv_row(right_transactions[index])
                if index < len(right_transactions)
                else ["", "", "", "", ""]
            )
            writer.writerow([*left_row, *right_row])

    def _transaction_csv_row(self, transaction: BankTransaction | BookTransaction) -> list[str]:
        return [
            transaction.trans_date.strftime("%Y-%m-%d") if transaction.trans_date else "",
            transaction.reference or "",
            transaction.narration or "",
            self._format_direction_amount(transaction, "debit"),
            self._format_direction_amount(transaction, "credit"),
        ]

    def _write_match_lane_section(
        self,
        *,
        writer: csv.writer,
        title: str,
        subtitle: str,
        book_label: str,
        bank_label: str,
        book_direction: str,
        bank_direction: str,
        match_groups: Sequence[MatchGroup],
    ) -> None:
        book_subtotal = self._sum_direction_amounts(
            [
                tx
                for group in match_groups
                for tx in group.book_transactions
                if not getattr(tx, "is_removed", False)
            ],
            book_direction,
        )
        bank_subtotal = self._sum_direction_amounts(
            [
                tx
                for group in match_groups
                for tx in group.bank_transactions
                if not getattr(tx, "is_removed", False)
            ],
            bank_direction,
        )

        writer.writerow([title])
        writer.writerow([subtitle])
        writer.writerow(
            [
                f"{book_label} subtotal",
                self._format_money(book_subtotal),
                f"{bank_label} subtotal",
                self._format_money(bank_subtotal),
                "Difference",
                self._format_money((book_subtotal - bank_subtotal).quantize(Decimal("0.01"))),
            ]
        )
        writer.writerow(
            [
                book_label,
                "",
                "",
                "",
                "",
                bank_label,
                "",
                "",
                "",
                "",
                "Match",
                "",
            ]
        )
        writer.writerow(
            [
                "Date",
                "Reference",
                "Narration",
                "Debit",
                "Credit",
                "Date",
                "Reference",
                "Narration",
                "Debit",
                "Credit",
                "Confidence",
                "Status",
            ]
        )

        if not match_groups:
            writer.writerow(["No matched items in this lane yet."])
            return

        for group in match_groups:
            self._write_match_group_rows(writer, group)

    def _write_match_group_rows(self, writer: csv.writer, match_group: MatchGroup) -> None:
        book_transactions = self._sorted_transactions(match_group.book_transactions)
        bank_transactions = self._sorted_transactions(match_group.bank_transactions)
        max_rows = max(len(book_transactions), len(bank_transactions), 1)
        confidence = match_group.confidence_score or 0
        status = (match_group.status or "pending").replace("_", " ").title()

        for index in range(max_rows):
            book_row = (
                self._transaction_csv_row(book_transactions[index])
                if index < len(book_transactions)
                else ["", "", "", "", ""]
            )
            bank_row = (
                self._transaction_csv_row(bank_transactions[index])
                if index < len(bank_transactions)
                else ["", "", "", "", ""]
            )
            writer.writerow(
                [
                    *book_row,
                    *bank_row,
                    f"{confidence:.0f}%" if index == 0 else "",
                    status if index == 0 else "",
                ]
            )

    def _write_bucket_section(
        self,
        *,
        writer: csv.writer,
        title: str,
        subtitle: str,
        left_label: str,
        right_label: str,
        left_direction: str,
        right_direction: str,
        left_transactions: Sequence[BankTransaction | BookTransaction],
        right_transactions: Sequence[BankTransaction | BookTransaction],
    ) -> None:
        left_subtotal = self._sum_direction_amounts(left_transactions, left_direction)
        right_subtotal = self._sum_direction_amounts(right_transactions, right_direction)

        writer.writerow([title])
        writer.writerow([subtitle])
        writer.writerow(
            [
                f"{left_label} subtotal",
                self._format_money(left_subtotal),
                f"{right_label} subtotal",
                self._format_money(right_subtotal),
                "Difference",
                self._format_money((left_subtotal - right_subtotal).quantize(Decimal("0.01"))),
            ]
        )
        writer.writerow([left_label, "", "", "", "", right_label, "", "", "", ""])
        writer.writerow(
            [
                "Date",
                "Reference",
                "Narration",
                "Debit",
                "Credit",
                "Date",
                "Reference",
                "Narration",
                "Debit",
                "Credit",
            ]
        )

        if not left_transactions and not right_transactions:
            writer.writerow(["No items in this section."])
            return

        self._write_dual_bucket_rows(writer, left_transactions, right_transactions)

    def _write_single_bucket_section(
        self,
        *,
        writer: csv.writer,
        title: str,
        subtitle: str,
        direction: str,
        transactions: Sequence[BankTransaction | BookTransaction],
    ) -> None:
        subtotal = self._sum_direction_amounts(transactions, direction)

        writer.writerow([title])
        writer.writerow([subtitle])
        writer.writerow(["Rows", len(transactions), "Subtotal", self._format_money(subtotal)])
        writer.writerow(["Date", "Reference", "Narration", "Debit", "Credit"])

        if not transactions:
            writer.writerow(["No items in this section."])
            return

        for transaction in transactions:
            writer.writerow(self._transaction_csv_row(transaction))

    def _active_transactions(
        self,
        transactions: Sequence[BankTransaction | BookTransaction],
    ) -> list[BankTransaction | BookTransaction]:
        return [tx for tx in transactions if not getattr(tx, "is_removed", False)]

    def _active_unresolved_transactions(
        self,
        transactions: Sequence[BankTransaction | BookTransaction],
    ) -> list[BankTransaction | BookTransaction]:
        return [
            tx
            for tx in transactions
            if tx.status != "matched" and not getattr(tx, "is_removed", False)
        ]

    def _removed_transactions_for_direction(
        self,
        transactions: Sequence[BankTransaction | BookTransaction],
        direction: str,
    ) -> list[BankTransaction | BookTransaction]:
        filtered = [
            tx
            for tx in transactions
            if tx.status != "matched"
            and getattr(tx, "is_removed", False)
            and tx.direction == direction
        ]
        return self._sorted_transactions(filtered)

    def _transactions_for_direction(
        self,
        transactions: Sequence[BankTransaction | BookTransaction],
        direction: str,
    ) -> list[BankTransaction | BookTransaction]:
        filtered = [
            tx
            for tx in self._active_unresolved_transactions(transactions)
            if tx.direction == direction
        ]
        return self._sorted_transactions(filtered)

    def _all_transactions_for_direction(
        self,
        transactions: Sequence[BankTransaction | BookTransaction],
        direction: str,
    ) -> list[BankTransaction | BookTransaction]:
        filtered = [tx for tx in transactions if tx.direction == direction]
        return self._sorted_transactions(filtered)

    def _match_groups_for_lane(
        self,
        match_groups: Sequence[MatchGroup],
        lane: str,
    ) -> list[MatchGroup]:
        filtered_groups = [
            group
            for group in match_groups
            if self._match_group_lane(group) == lane
        ]
        return sorted(
            filtered_groups,
            key=lambda group: (group.confidence_score or 0, group.created_at or datetime.min),
            reverse=True,
        )

    def _match_group_lane(self, match_group: MatchGroup) -> str:
        bank_directions = {tx.direction for tx in match_group.bank_transactions}
        book_directions = {tx.direction for tx in match_group.book_transactions}
        if "debit" in bank_directions or "credit" in book_directions:
            return "cashCreditBankDebit"
        return "cashDebitBankCredit"

    def _sorted_transactions(
        self,
        transactions: Sequence[BankTransaction | BookTransaction],
    ) -> list[BankTransaction | BookTransaction]:
        return sorted(
            transactions,
            key=lambda tx: (tx.trans_date or datetime.min, tx.created_at or datetime.min),
        )

    def _sum_direction_amounts(
        self,
        transactions: Sequence[BankTransaction | BookTransaction],
        direction: str,
    ) -> Decimal:
        total = sum(
            (
                self._to_decimal(getattr(tx, f"{direction}_amount", self.ZERO))
                for tx in transactions
            ),
            self.ZERO,
        )
        return total.quantize(Decimal("0.01"))

    def _format_direction_amount(
        self,
        transaction: BankTransaction | BookTransaction,
        direction: str,
    ) -> str:
        amount = self._to_decimal(getattr(transaction, f"{direction}_amount", self.ZERO))
        return self._format_money(amount) if amount else ""

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
            (
                self._to_decimal(
                    getattr(tx, f"{direction}_amount", self.ZERO)
                )
                for tx in matching_transactions
            ),
            self.ZERO,
        ).quantize(Decimal("0.01"))
        return ReconciliationBucketSummary(
            count=len(matching_transactions),
            total=total,
        )

    def _format_money(self, value: Decimal | float | int) -> str:
        return f"{self._to_decimal(value):.2f}"
