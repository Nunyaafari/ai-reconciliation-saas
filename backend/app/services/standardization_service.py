import hashlib
import json
import logging
import re
from typing import Dict, List, Any
from datetime import datetime, date
from decimal import Decimal
from app.schemas import ColumnMapping
from sqlalchemy.orm import Session
from app.database.models import IngestionFingerprint

logger = logging.getLogger(__name__)


class StandardizationService:
    """Handles data cleaning and normalization to prescribed fields."""

    PRESCRIBED_FIELDS = ["date", "narration", "reference", "amount"]

    def standardize(
        self,
        raw_transactions: List[Dict[str, Any]],
        column_mapping: ColumnMapping,
        source: str = "bank",
    ) -> List[Dict[str, Any]]:
        """
        Transform raw extracted transactions into standardized format.

        Prescription: All transactions must have:
        - trans_date: YYYY-MM-DD (ISO format)
        - narration: Cleaned text
        - reference: Optional, normalized
        - amount: Decimal (can be positive/negative)
        """

        standardized = []

        for idx, raw_tx in enumerate(raw_transactions):
            try:
                amount_value, direction = self._resolve_amount_and_direction(
                    raw_tx, column_mapping, source
                )
                standardized_tx = {
                    "trans_date": self._standardize_date(
                        raw_tx.get(column_mapping.date, "")
                    ),
                    "narration": self._clean_narration(
                        raw_tx.get(column_mapping.narration, "")
                    ),
                    "reference": self._normalize_reference(
                        raw_tx.get(column_mapping.reference)
                    ),
                    "amount": amount_value,
                    "direction": direction,
                    "debit_amount": abs(amount_value) if direction == "debit" else Decimal("0"),
                    "credit_amount": abs(amount_value) if direction == "credit" else Decimal("0"),
                }

                # Validate required fields
                if not standardized_tx["trans_date"] or not standardized_tx["amount"]:
                    logger.warning(f"Skipping row {idx}: missing required fields")
                    continue

                standardized.append(standardized_tx)

            except Exception as e:
                logger.warning(f"Error standardizing row {idx}: {str(e)}")
                continue

        logger.info(f"Standardized {len(standardized)} transactions")
        return standardized

    def _safe_key(self, value: Any) -> Any:
        if value in (None, "", "__none__", "__select__"):
            return None
        return value

    def _extract_debit_credit_values(
        self, raw_tx: Dict[str, Any], column_mapping: ColumnMapping
    ) -> tuple[Decimal | None, Decimal | None]:
        debit_value = None
        credit_value = None

        def _direction_marker(value: Any) -> str | None:
            if value in (None, ""):
                return None
            text = str(value).upper()
            if "CR" in text:
                return "credit"
            if "DR" in text:
                return "debit"
            return None

        debit_key = self._safe_key(getattr(column_mapping, "debit", None))
        if debit_key:
            raw_debit = raw_tx.get(debit_key)
            if raw_debit not in (None, ""):
                marker = _direction_marker(raw_debit)
                amount = self._standardize_amount(raw_debit)
                if marker == "credit":
                    if credit_value is None:
                        credit_value = amount
                else:
                    debit_value = amount

        credit_key = self._safe_key(getattr(column_mapping, "credit", None))
        if credit_key:
            raw_credit = raw_tx.get(credit_key)
            if raw_credit not in (None, ""):
                marker = _direction_marker(raw_credit)
                amount = self._standardize_amount(raw_credit)
                if marker == "debit":
                    if debit_value is None:
                        debit_value = amount
                else:
                    credit_value = amount

        return debit_value, credit_value

    def _resolve_direction(
        self,
        amount_value: Decimal,
        debit_value: Decimal | None,
        credit_value: Decimal | None,
        source: str,
    ) -> str | None:
        has_debit = debit_value is not None and debit_value != 0
        has_credit = credit_value is not None and credit_value != 0

        if has_debit and not has_credit:
            return "debit"
        if has_credit and not has_debit:
            return "credit"
        if has_debit and has_credit:
            return "debit" if debit_value >= credit_value else "credit"

        if amount_value > 0:
            return "credit" if source == "bank" else "debit"
        if amount_value < 0:
            return "debit" if source == "bank" else "credit"

        return None

    def _resolve_amount_and_direction(
        self,
        raw_tx: Dict[str, Any],
        column_mapping: ColumnMapping,
        source: str,
    ) -> tuple[Decimal, str | None]:
        amount_value = None

        amount_key = self._safe_key(getattr(column_mapping, "amount", None))
        debit_value, credit_value = self._extract_debit_credit_values(raw_tx, column_mapping)

        if amount_key:
            raw_amount = raw_tx.get(amount_key)
            if raw_amount not in (None, ""):
                amount_value = self._standardize_amount(raw_amount)

        if amount_value is None and (debit_value is not None or credit_value is not None):
            if source == "book":
                amount_value = (debit_value or Decimal("0")) - (credit_value or Decimal("0"))
            else:
                amount_value = (credit_value or Decimal("0")) - (debit_value or Decimal("0"))

        if amount_value is None:
            amount_value = Decimal("0")

        direction = self._resolve_direction(amount_value, debit_value, credit_value, source)
        return amount_value, direction

    def _standardize_date(self, date_str: str) -> str:
        """
        Convert any date format to YYYY-MM-DD.

        Accepts: MM/DD/YYYY, DD-MM-YYYY, YYYY/MM/DD, etc.
        """
        if isinstance(date_str, (datetime, date)):
            return date_str.strftime("%Y-%m-%d")

        if not date_str:
            return None

        date_formats = [
            "%m/%d/%Y",  # US: 01/15/2025
            "%d/%m/%Y",  # EU: 15/01/2025
            "%m-%d-%Y",  # 01-15-2025
            "%d-%m-%Y",  # 15-01-2025
            "%Y-%m-%d",  # ISO: 2025-01-15
            "%Y/%m/%d",  # 2025/01/15
            "%d.%m.%Y",  # German: 15.01.2025
            "%B %d, %Y",  # January 15, 2025
            "%b %d, %Y",  # Jan 15, 2025
        ]

        date_str = str(date_str).strip()

        for fmt in date_formats:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                return parsed_date.strftime("%Y-%m-%d")
            except ValueError:
                continue

        # If still not parsed, try common separators
        logger.warning(f"Could not parse date: {date_str}")
        return None

    def _standardize_amount(self, amount_str: Any) -> Decimal:
        """
        Convert amount to standardized Decimal.

        Handles:
        - "1,234.56" → 1234.56
        - "(1234.56)" → -1234.56 (bracket notation)
        - "$1234.56" → 1234.56
        - Negative numbers
        """
        if isinstance(amount_str, (int, float)):
            return Decimal(str(amount_str))

        if not amount_str:
            return Decimal("0")

        amount_str = str(amount_str).strip()

        upper = amount_str.upper()
        dr_cr_sign = None
        if "DR" in upper:
            dr_cr_sign = -1
        if "CR" in upper and dr_cr_sign is None:
            dr_cr_sign = 1

        # Remove currency symbols
        amount_str = amount_str.replace("$", "").replace("€", "").replace("£", "")

        # Handle bracket notation (accounting negative)
        is_negative = amount_str.startswith("(") and amount_str.endswith(")")
        if is_negative:
            amount_str = amount_str[1:-1]

        # Remove commas (thousands separator) + any letters like CR/DR
        amount_str = amount_str.replace(",", "")
        amount_str = re.sub(r"[A-Za-z]", "", amount_str)

        try:
            amount = Decimal(amount_str)
            if is_negative:
                amount = -amount
            if dr_cr_sign is not None and amount > 0:
                amount = abs(amount) if dr_cr_sign > 0 else -abs(amount)
            return amount
        except:
            logger.warning(f"Could not parse amount: {amount_str}")
            return Decimal("0")

    def _clean_narration(self, narration: str) -> str:
        """
        Clean and normalize transaction narration.

        Removes:
        - Bank-specific prefixes (TRF FROM, REF:, etc.)
        - Extra whitespace
        - Repetitive noise
        - Special characters
        """
        if not narration:
            return ""

        narration = str(narration).strip()

        # Remove common bank prefixes
        prefixes = [
            "TRF FROM", "TRF TO", "TRANSFER",
            "PAYMENT TO", "PAYMENT FROM",
            "DEP:", "DEPOSIT",
            "CHK:", "CHECK",
            "ACH", "WIRE",
        ]

        for prefix in prefixes:
            if narration.startswith(prefix.upper()):
                narration = narration[len(prefix):].strip()

        # Remove common suffixes
        suffixes = ["REF #", "REF:", "ID:", "CONF:"]
        for suffix in suffixes:
            if suffix in narration:
                narration = narration[: narration.find(suffix)].strip()

        # Clean up multiple spaces
        narration = " ".join(narration.split())

        # Limit length
        narration = narration[:500]

        return narration

    def _normalize_reference(self, reference: Any) -> str:
        """
        Normalize reference number (check #, invoice #, etc.).

        Handle: Remove spaces, standardize case
        """
        if not reference:
            return None

        reference = str(reference).strip().upper()

        # Remove spaces
        reference = reference.replace(" ", "")

        # Limit length
        reference = reference[:100]

        return reference if reference else None

    def calculate_file_hash(self, file_content: bytes, file_name: str) -> str:
        """Calculate SHA256 hash of file structure (not content)."""
        # Hash the file name and size to create a fingerprint
        fingerprint_data = f"{file_name}_{len(file_content)}".encode()
        return hashlib.sha256(fingerprint_data).hexdigest()

    def save_fingerprint(
        self,
        org_id: str,
        file_name: str,
        column_mapping: ColumnMapping,
        db: Session,
    ) -> None:
        """
        Save learned column mapping pattern for future uploads.

        Next time this org uploads a similar file, system remembers the mapping.
        """
        file_hash = self.calculate_file_hash(file_name.encode(), file_name)

        # Check if fingerprint already exists
        existing = db.query(IngestionFingerprint).filter(
            IngestionFingerprint.org_id == org_id,
            IngestionFingerprint.file_hash == file_hash,
        ).first()

        if existing:
            # Update usage count
            existing.uses_count += 1
            existing.last_used_at = datetime.utcnow()
            db.commit()
            logger.info(f"Updated fingerprint for {file_name}: uses_count={existing.uses_count}")
        else:
            # Create new fingerprint
            fingerprint = IngestionFingerprint(
                org_id=org_id,
                file_hash=file_hash,
                file_name=file_name,
                file_source="bank",  # TODO: determine from context
                column_map=column_mapping.model_dump_json(),
                confidence=85,  # Default confidence for new fingerprints
                uses_count=1,
            )
            db.add(fingerprint)
            db.commit()
            logger.info(f"Saved new fingerprint for {file_name}")
