import logging
from typing import List, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
from app.database.models import BankTransaction, BookTransaction

logger = logging.getLogger(__name__)


def _token_set_ratio(left: str, right: str) -> float:
    from rapidfuzz import fuzz

    return float(fuzz.token_set_ratio(left, right))


def _token_sort_ratio(left: str, right: str) -> float:
    from rapidfuzz import fuzz

    return float(fuzz.token_sort_ratio(left, right))


class MatchingService:
    """Core matching engine - computes confidence scores and suggests matches."""

    # Confidence thresholds
    HIGH_CONFIDENCE_THRESHOLD = 95
    MEDIUM_CONFIDENCE_THRESHOLD = 70
    LOW_CONFIDENCE_THRESHOLD = 0

    # Signal weights (must sum to 1.0)
    WEIGHTS = {
        "value": 0.50,      # 50% - Critical
        "date": 0.20,       # 20% - Important
        "reference": 0.20,  # 20% - Important
        "narration": 0.10,  # 10% - Supportive
    }

    # Performance guards for large datasets
    MAX_COMBO_CANDIDATES = 60
    MAX_COMBO_DATASET = 250
    COMBO_DATE_WINDOW_DAYS = 7
    AMOUNT_TOLERANCE = 0.01
    NARRATION_MATCH_THRESHOLD = 0.85

    def match_transactions(
        self,
        bank_transactions: List[BankTransaction],
        book_transactions: List[BookTransaction],
        org_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Run deterministic + probabilistic matching.

        Returns list of matches with:
        {
            "type": "1:1" | "1:N" | "N:1",
            "bank_transaction_ids": [...],
            "book_transaction_ids": [...],
            "confidence": 0-100,
            "total_bank_amount": Decimal,
            "total_book_amount": Decimal,
            "variance": Decimal,
        }
        """
        matches = []
        matched_bank_ids = set()
        matched_book_ids = set()

        # Phase 1: Deterministic Matching (1:1, Exact)
        for bank_tx in bank_transactions:
            if bank_tx.id in matched_bank_ids:
                continue

            for book_tx in book_transactions:
                if book_tx.id in matched_book_ids:
                    continue

                if self._is_deterministic_match(bank_tx, book_tx):
                    confidence = 100
                    matches.append({
                        "type": "1:1",
                        "bank_transaction_ids": [bank_tx.id],
                        "book_transaction_ids": [book_tx.id],
                        "confidence": confidence,
                        "total_bank_amount": bank_tx.amount,
                        "total_book_amount": book_tx.amount,
                        "variance": Decimal("0"),
                    })
                    matched_bank_ids.add(bank_tx.id)
                    matched_book_ids.add(book_tx.id)
                    break

        # Phase 2: Probabilistic Matching (1:1, Fuzzy)
        for bank_tx in bank_transactions:
            if bank_tx.id in matched_bank_ids:
                continue

            best_book_tx = None
            best_score = 0

            for book_tx in book_transactions:
                if book_tx.id in matched_book_ids:
                    continue
                if not self._amounts_match(bank_tx, book_tx):
                    continue

                score = self.calculate_confidence_score(bank_tx, book_tx)

                if score > best_score and score >= self.MEDIUM_CONFIDENCE_THRESHOLD:
                    best_score = score
                    best_book_tx = book_tx

            if best_book_tx:
                matches.append({
                    "type": "1:1",
                    "bank_transaction_ids": [bank_tx.id],
                    "book_transaction_ids": [best_book_tx.id],
                    "confidence": int(best_score),
                    "total_bank_amount": bank_tx.amount,
                    "total_book_amount": best_book_tx.amount,
                    "variance": abs(bank_tx.amount - best_book_tx.amount),
                })
                matched_bank_ids.add(bank_tx.id)
                matched_book_ids.add(best_book_tx.id)

        # Phase 3: Many-to-One Matching (Handle splits & consolidations)
        # For each unmatched bank transaction, find combinations of book transactions that sum to it
        if len(book_transactions) > self.MAX_COMBO_DATASET:
            logger.info(
                "Skipping combination matching for org %s (book txs: %s)",
                org_id,
                len(book_transactions),
            )
            return matches

        for bank_tx in bank_transactions:
            if bank_tx.id in matched_bank_ids:
                continue

            # Look for combinations of 2-5 book transactions
            combinations = self._find_matching_combinations(
                bank_tx,
                [tx for tx in book_transactions if tx.id not in matched_book_ids],
            )

            if combinations:
                best_combo = combinations[0]  # Already sorted by score
                matches.append({
                    "type": f"1:{len(best_combo['book_transaction_ids'])}",
                    "bank_transaction_ids": [bank_tx.id],
                    "book_transaction_ids": best_combo["book_transaction_ids"],
                    "confidence": best_combo["confidence"],
                    "total_bank_amount": bank_tx.amount,
                    "total_book_amount": best_combo["total_amount"],
                    "variance": best_combo["variance"],
                })
                matched_bank_ids.add(bank_tx.id)
                for book_tx_id in best_combo["book_transaction_ids"]:
                    matched_book_ids.add(book_tx_id)

        logger.info(f"Found {len(matches)} matches for org {org_id}")
        return matches

    def calculate_confidence_score(
        self,
        bank_tx: BankTransaction,
        book_tx: BookTransaction,
    ) -> float:
        """
        Calculate rule-based confidence score aligned to the workbook passes:

        100% -> amount + reference + date + narration
         75% -> amount + reference + (date or narration)
         50% -> amount + reference
         25% -> any other combination of 2 or 3 matching columns
          0% -> fewer than 2 columns match
        """
        return self._calculate_rule_based_confidence(bank_tx, book_tx)

    def _normalized_direction(self, transaction: BankTransaction | BookTransaction) -> str | None:
        return getattr(transaction, "direction", None)

    def _reconciliation_amount(self, transaction: BankTransaction | BookTransaction) -> float:
        direction = self._normalized_direction(transaction)
        if direction == "debit":
            debit_amount = getattr(transaction, "debit_amount", None)
            if debit_amount not in (None, 0):
                return abs(float(debit_amount))
        if direction == "credit":
            credit_amount = getattr(transaction, "credit_amount", None)
            if credit_amount not in (None, 0):
                return abs(float(credit_amount))
        return abs(float(getattr(transaction, "amount", 0) or 0))

    def _directions_match_reconciliation_lanes(
        self,
        bank_tx: BankTransaction,
        book_tx: BookTransaction,
    ) -> bool:
        bank_direction = self._normalized_direction(bank_tx)
        book_direction = self._normalized_direction(book_tx)
        return (
            (bank_direction == "credit" and book_direction == "debit")
            or (bank_direction == "debit" and book_direction == "credit")
        )

    def _calculate_value_signal(self, bank_tx: BankTransaction, book_tx: BookTransaction) -> float:
        """Value signal: 1.0 if reconcilable lanes and magnitudes match, 0.0 otherwise."""
        if not self._directions_match_reconciliation_lanes(bank_tx, book_tx):
            return 0.0

        bank_val = self._reconciliation_amount(bank_tx)
        book_val = self._reconciliation_amount(book_tx)

        if abs(bank_val - book_val) < self.AMOUNT_TOLERANCE:
            return 1.0
        return 0.0

    def _amounts_match(self, bank_tx: BankTransaction, book_tx: BookTransaction) -> bool:
        if not self._directions_match_reconciliation_lanes(bank_tx, book_tx):
            return False
        bank_val = self._reconciliation_amount(bank_tx)
        book_val = self._reconciliation_amount(book_tx)
        return abs(bank_val - book_val) < self.AMOUNT_TOLERANCE

    def _calculate_date_signal(self, bank_date: datetime, book_date: datetime) -> float:
        """Date signal: Decay function based on days difference."""
        if not bank_date or not book_date:
            return 0.5

        days_diff = abs((bank_date - book_date).days)

        if days_diff == 0:
            return 1.0
        elif days_diff <= 3:
            return 0.8
        elif days_diff <= 7:
            return 0.4
        else:
            return 0.0

    def _calculate_reference_signal(self, bank_ref: str, book_ref: str) -> float:
        """Reference signal: 1.0 if exact match, 0.5 if missing, 0.0 if different."""
        if not bank_ref and not book_ref:
            return 0.5  # Both missing - neutral

        if not bank_ref or not book_ref:
            return 0.5  # One missing - neutral

        if bank_ref.upper() == book_ref.upper():
            return 1.0  # Exact match

        return 0.0  # Different

    def _calculate_narration_signal(self, bank_narr: str, book_narr: str) -> float:
        """Narration signal: Fuzzy string matching."""
        if not bank_narr or not book_narr:
            return 0.0

        # Use RapidFuzz for fast, accurate fuzzy matching
        similarity = _token_sort_ratio(bank_narr, book_narr) / 100.0

        return similarity

    def _is_date_match(
        self,
        bank_date: datetime,
        book_date: datetime,
    ) -> bool:
        if not bank_date or not book_date:
            return False
        return bank_date.date() == book_date.date()

    def _is_reference_match(self, bank_ref: str, book_ref: str) -> bool:
        if not bank_ref or not book_ref:
            return False
        return bank_ref.strip().upper() == book_ref.strip().upper()

    def _is_narration_match(self, bank_narr: str, book_narr: str) -> bool:
        if not bank_narr or not book_narr:
            return False
        similarity = _token_sort_ratio(bank_narr, book_narr) / 100.0
        return similarity >= self.NARRATION_MATCH_THRESHOLD

    def _matching_column_count(
        self,
        bank_tx: BankTransaction,
        book_tx: BookTransaction,
    ) -> int:
        return sum(
            [
                1 if self._amounts_match(bank_tx, book_tx) else 0,
                1 if self._is_reference_match(bank_tx.reference, book_tx.reference) else 0,
                1 if self._is_date_match(bank_tx.trans_date, book_tx.trans_date) else 0,
                1 if self._is_narration_match(bank_tx.narration, book_tx.narration) else 0,
            ]
        )

    def _calculate_rule_based_confidence(
        self,
        bank_tx: BankTransaction,
        book_tx: BookTransaction,
    ) -> int:
        amount_match = self._amounts_match(bank_tx, book_tx)
        reference_match = self._is_reference_match(bank_tx.reference, book_tx.reference)
        date_match = self._is_date_match(bank_tx.trans_date, book_tx.trans_date)
        narration_match = self._is_narration_match(bank_tx.narration, book_tx.narration)

        if amount_match and reference_match and date_match and narration_match:
            return 100

        if amount_match and reference_match and (date_match or narration_match):
            return 75

        if amount_match and reference_match:
            return 50

        if sum([amount_match, reference_match, date_match, narration_match]) >= 2:
            return 25

        return 0

    def _is_deterministic_match(
        self,
        bank_tx: BankTransaction,
        book_tx: BookTransaction,
    ) -> bool:
        return self._calculate_rule_based_confidence(bank_tx, book_tx) == 100

    def get_suggestions_for_transaction(
        self,
        bank_tx: BankTransaction,
        available_book_txs: List[BookTransaction],
    ) -> List[Dict[str, Any]]:
        """
        Get top 3 suggestions for an unmatched bank transaction.

        Returns list of suggestions sorted by confidence (highest first).
        """
        suggestions = []

        for book_tx in available_book_txs:
            if not self._directions_match_reconciliation_lanes(bank_tx, book_tx):
                continue

            signals = self._get_signal_breakdown(bank_tx, book_tx)
            confidence = self._calculate_rule_based_confidence(bank_tx, book_tx)

            if confidence >= 25:
                suggestions.append({
                    "book_tx_id": book_tx.id,
                    "confidence": confidence,
                    "signals": signals,
                    "explanation": self._explain_match(signals, confidence),
                })

        # Sort by confidence (highest first)
        suggestions.sort(key=lambda x: x["confidence"], reverse=True)

        # Return top 3
        return suggestions[:3]

    def _get_signal_breakdown(
        self,
        bank_tx: BankTransaction,
        book_tx: BookTransaction,
    ) -> Dict[str, float]:
        """Get individual signal scores for explanation."""
        return {
            "value": self._calculate_value_signal(bank_tx, book_tx),
            "date": self._calculate_date_signal(bank_tx.trans_date, book_tx.trans_date),
            "reference": self._calculate_reference_signal(bank_tx.reference, book_tx.reference),
            "narration": self._calculate_narration_signal(bank_tx.narration, book_tx.narration),
        }

    def _calculate_non_amount_confidence(self, signals: Dict[str, float]) -> int:
        """Score suggestions when the amount does not match."""
        matched_columns = sum(
            [
                1 if signals["value"] >= 1.0 else 0,
                1 if signals["reference"] >= 1.0 else 0,
                1 if signals["date"] >= 1.0 else 0,
                1 if signals["narration"] >= self.NARRATION_MATCH_THRESHOLD else 0,
            ]
        )
        return 25 if matched_columns >= 2 else 0

    def _explain_match(self, signals: Dict[str, float], confidence: int) -> str:
        """Generate human-readable explanation for a match."""
        reasons = []

        if signals["value"] == 1.0:
            reasons.append("Amount matches exactly")
        if signals["date"] >= 1.0:
            reasons.append("Date matches")
        if signals["reference"] == 1.0:
            reasons.append("Reference number matches")
        if signals["narration"] >= self.NARRATION_MATCH_THRESHOLD:
            reasons.append("Description is similar")

        if not reasons:
            reasons.append("Two or more columns align")

        return " • ".join(reasons)

    def _find_matching_combinations(
        self,
        bank_tx: BankTransaction,
        available_book_txs: List[BookTransaction],
        max_combo_size: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Find combinations of book transactions that sum to bank transaction amount.

        Returns list of combinations sorted by confidence.

        This handles scenarios like:
        - 1 bank entry = 3 book entries (POS settlement)
        - 1 bank entry = 2 book entries (split deposit)
        """
        from itertools import combinations

        matching_combos = []
        target_amount = self._reconciliation_amount(bank_tx)

        if len(available_book_txs) < 2:
            return []

        # Filter candidates to keep search tractable
        candidate_txs = []
        for tx in available_book_txs:
            if not self._directions_match_reconciliation_lanes(bank_tx, tx):
                continue
            candidate_amount = self._reconciliation_amount(tx)
            if candidate_amount == 0:
                continue
            if candidate_amount > target_amount:
                continue
            if bank_tx.trans_date and tx.trans_date:
                if abs((bank_tx.trans_date - tx.trans_date).days) > self.COMBO_DATE_WINDOW_DAYS:
                    continue
            candidate_txs.append(tx)

        if len(candidate_txs) < 2:
            return []

        if len(candidate_txs) > self.MAX_COMBO_CANDIDATES:
            # Prefer closer dates and amounts to reduce branching
            candidate_txs.sort(
                key=lambda tx: (
                    abs((bank_tx.trans_date - tx.trans_date).days)
                    if bank_tx.trans_date and tx.trans_date
                    else 9999,
                    abs(self._reconciliation_amount(tx) - target_amount),
                )
            )
            candidate_txs = candidate_txs[: self.MAX_COMBO_CANDIDATES]

        # Try combinations of 2-5 transactions
        for combo_size in range(2, min(max_combo_size + 1, len(candidate_txs) + 1)):
            for combo in combinations(candidate_txs, combo_size):
                combo_match_sum = sum(self._reconciliation_amount(tx) for tx in combo)
                combo_signed_sum = sum(float(tx.amount) for tx in combo)

                # Check if sum is close to target (within $0.01)
                if abs(combo_match_sum - target_amount) < self.AMOUNT_TOLERANCE:
                    # Calculate average confidence across all pairs
                    pair_scores = [
                        self.calculate_confidence_score(bank_tx, book_tx)
                        for book_tx in combo
                    ]
                    avg_confidence = sum(pair_scores) / len(pair_scores)

                    matching_combos.append({
                        "book_transaction_ids": [tx.id for tx in combo],
                        "total_amount": combo_signed_sum,
                        "variance": abs(combo_match_sum - target_amount),
                        "confidence": int(avg_confidence),
                    })

        # Sort by confidence (highest first)
        matching_combos.sort(key=lambda x: x["confidence"], reverse=True)

        return matching_combos
