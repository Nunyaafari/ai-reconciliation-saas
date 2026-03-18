import logging
from typing import List, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
from rapidfuzz import fuzz
from app.database.models import BankTransaction, BookTransaction

logger = logging.getLogger(__name__)


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
                if not self._amounts_match(bank_tx.amount, book_tx.amount):
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
        Calculate weighted confidence score: 0-100

        Formula: S = (50% × value) + (20% × date) + (20% × ref) + (10% × narration)
        """
        # Value signal (50%)
        value_signal = self._calculate_value_signal(bank_tx.amount, book_tx.amount)

        # Date signal (20%)
        date_signal = self._calculate_date_signal(bank_tx.trans_date, book_tx.trans_date)

        # Reference signal (20%)
        ref_signal = self._calculate_reference_signal(bank_tx.reference, book_tx.reference)

        # Narration signal (10%)
        narration_signal = self._calculate_narration_signal(bank_tx.narration, book_tx.narration)

        # Weighted sum
        score = (
            self.WEIGHTS["value"] * value_signal +
            self.WEIGHTS["date"] * date_signal +
            self.WEIGHTS["reference"] * ref_signal +
            self.WEIGHTS["narration"] * narration_signal
        )

        return int(score * 100)

    def _calculate_value_signal(self, bank_amount: Decimal, book_amount: Decimal) -> float:
        """Value signal: 1.0 if exact match, 0.0 if different."""
        # Handle both Decimal and float types
        bank_val = float(bank_amount) if bank_amount else 0
        book_val = float(book_amount) if book_amount else 0

        if abs(bank_val - book_val) < self.AMOUNT_TOLERANCE:  # Floating point tolerance
            return 1.0
        return 0.0

    def _amounts_match(self, bank_amount: Decimal, book_amount: Decimal) -> bool:
        bank_val = float(bank_amount) if bank_amount else 0
        book_val = float(book_amount) if book_amount else 0
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
        similarity = fuzz.token_sort_ratio(bank_narr, book_narr) / 100.0

        return similarity

    def _is_deterministic_match(
        self,
        bank_tx: BankTransaction,
        book_tx: BookTransaction,
    ) -> bool:
        """
        Deterministic match: Exact value AND (Exact ref OR very similar narration + close date)
        """
        # Value must match exactly
        if abs(float(bank_tx.amount) - float(book_tx.amount)) >= 0.01:
            return False

        # Date must be within 3 days
        if abs((bank_tx.trans_date - book_tx.trans_date).days) > 3:
            return False

        # Either reference matches OR narration is very similar
        if bank_tx.reference and book_tx.reference:
            if bank_tx.reference.upper() == book_tx.reference.upper():
                return True

        # Check narration similarity
        if bank_tx.narration and book_tx.narration:
            similarity = fuzz.token_sort_ratio(bank_tx.narration, book_tx.narration) / 100.0
            if similarity > 0.85:  # Very high threshold for deterministic
                return True

        return False

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
            if not self._amounts_match(bank_tx.amount, book_tx.amount):
                continue
            confidence = self.calculate_confidence_score(bank_tx, book_tx)

            if confidence >= self.MEDIUM_CONFIDENCE_THRESHOLD:
                signals = self._get_signal_breakdown(bank_tx, book_tx)
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
            "value": self._calculate_value_signal(bank_tx.amount, book_tx.amount),
            "date": self._calculate_date_signal(bank_tx.trans_date, book_tx.trans_date),
            "reference": self._calculate_reference_signal(bank_tx.reference, book_tx.reference),
            "narration": self._calculate_narration_signal(bank_tx.narration, book_tx.narration),
        }

    def _explain_match(self, signals: Dict[str, float], confidence: int) -> str:
        """Generate human-readable explanation for a match."""
        reasons = []

        if signals["value"] == 1.0:
            reasons.append("Amount matches exactly")
        if signals["date"] >= 0.8:
            reasons.append("Date is very close")
        if signals["reference"] == 1.0:
            reasons.append("Reference number matches")
        if signals["narration"] >= 0.7:
            reasons.append("Description is similar")

        if not reasons:
            reasons.append("Multiple signal match")

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
        target_amount = float(bank_tx.amount)

        if len(available_book_txs) < 2:
            return []

        # Filter candidates to keep search tractable
        candidate_txs = []
        for tx in available_book_txs:
            if float(tx.amount) == 0:
                continue
            # Same sign and not larger than target
            if (float(tx.amount) > 0) != (target_amount > 0):
                continue
            if abs(float(tx.amount)) > abs(target_amount):
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
                    abs(abs(float(tx.amount)) - abs(target_amount)),
                )
            )
            candidate_txs = candidate_txs[: self.MAX_COMBO_CANDIDATES]

        # Try combinations of 2-5 transactions
        for combo_size in range(2, min(max_combo_size + 1, len(candidate_txs) + 1)):
            for combo in combinations(candidate_txs, combo_size):
                combo_sum = sum(float(tx.amount) for tx in combo)

                # Check if sum is close to target (within $0.01)
                if abs(combo_sum - target_amount) < self.AMOUNT_TOLERANCE:
                    # Calculate average confidence across all pairs
                    pair_scores = [
                        self.calculate_confidence_score(bank_tx, book_tx)
                        for book_tx in combo
                    ]
                    avg_confidence = sum(pair_scores) / len(pair_scores)

                    matching_combos.append({
                        "book_transaction_ids": [tx.id for tx in combo],
                        "total_amount": combo_sum,
                        "variance": abs(combo_sum - target_amount),
                        "confidence": int(avg_confidence),
                    })

        # Sort by confidence (highest first)
        matching_combos.sort(key=lambda x: x["confidence"], reverse=True)

        return matching_combos
