import json
import logging
import re
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.models import (
    BankTransaction,
    BookTransaction,
    ExtractionDraft,
    ExtractionDraftEdit,
    MatchGroup,
    UploadSession,
    User,
)
from app.schemas import (
    ColumnMapping,
    ExtractionDraftFinalizeResponse,
    ExtractionDraftRegionUpdateRequest,
    ExtractionDraftResponse,
    ExtractionDraftRow,
    ExtractionDraftRowsUpdateRequest,
    ExtractionDraftValidationIssue,
    ExtractionDraftValidationSummary,
)
from app.services.extraction_service import ExtractionService
from app.services.standardization_service import StandardizationService

logger = logging.getLogger(__name__)


class PdfDraftReviewService:
    """Persist, validate, and finalize reviewed PDF extraction drafts."""

    def __init__(self) -> None:
        self.extraction_service = ExtractionService()
        self.standardization_service = StandardizationService()

    def get_active_draft_for_session(
        self,
        session_id: UUID,
        org_id: UUID,
        db: Session,
    ) -> Optional[ExtractionDraft]:
        return (
            db.query(ExtractionDraft)
            .filter(
                ExtractionDraft.upload_session_id == session_id,
                ExtractionDraft.org_id == org_id,
                ExtractionDraft.status.in_(["draft", "reviewed"]),
            )
            .order_by(ExtractionDraft.version.desc(), ExtractionDraft.created_at.desc())
            .first()
        )

    def get_draft_or_404(
        self,
        draft_id: UUID,
        org_id: UUID,
        db: Session,
    ) -> ExtractionDraft:
        draft = (
            db.query(ExtractionDraft)
            .filter(
                ExtractionDraft.id == draft_id,
                ExtractionDraft.org_id == org_id,
            )
            .first()
        )
        if not draft:
            raise ValueError("Extraction draft not found")
        return draft

    def build_or_get_draft(
        self,
        session: UploadSession,
        file_content: bytes,
        current_user: User,
        db: Session,
    ) -> ExtractionDraftResponse:
        existing = self.get_active_draft_for_session(session.id, session.org_id, db)
        if existing:
            return self.serialize_draft(existing)

        extraction_result = self.extraction_service.extract(
            file_content=file_content,
            file_type=session.file_type,
            org_id=str(session.org_id),
            preview_mode=False,
        )
        raw_data = extraction_result.get("raw_data") or []
        column_headers = extraction_result.get("column_headers") or []
        if not column_headers and raw_data:
            column_headers = [f"Col_{idx + 1}" for idx in range(len(raw_data[0]))]

        mapping = self.extraction_service.guess_column_mapping(
            raw_data=raw_data,
            org_id=session.org_id,
            column_headers=column_headers,
            upload_source=session.upload_source,
        )
        rows = self._build_rows(raw_data, column_headers)
        region = self._infer_region(rows)
        rows = self._apply_region_flags(rows, region["start"], region["end"])
        template = self.standardization_service.get_pdf_template(
            org_id=str(session.org_id),
            file_name=session.file_name,
            file_source=session.upload_source,
            column_headers=column_headers,
            source_method=extraction_result.get("method", "unknown"),
            db=db,
        )
        if template:
            mapping, region, rows = self._apply_template(
                rows=rows,
                column_headers=column_headers,
                mapping=mapping,
                region=region,
                template=template,
            )
        validation = self._build_validation_summary(rows, column_headers, mapping)

        current_version = (
            db.query(ExtractionDraft)
            .filter(
                ExtractionDraft.upload_session_id == session.id,
                ExtractionDraft.org_id == session.org_id,
            )
            .count()
        )

        draft = ExtractionDraft(
            org_id=session.org_id,
            upload_session_id=session.id,
            version=current_version + 1,
            source_method=extraction_result.get("method", "unknown"),
            confidence=int(extraction_result.get("confidence", 0) or 0),
            status="draft",
            column_headers_json=self._dump_json(column_headers),
            mapped_fields_json=self._dump_json(mapping.model_dump()),
            raw_rows_json=self._dump_json([row.model_dump() for row in rows]),
            reviewed_rows_json=self._dump_json([row.model_dump() for row in rows]),
            validation_summary_json=self._dump_json(validation.model_dump()),
            header_row_index=None,
            table_start_row_index=region["start"],
            table_end_row_index=region["end"],
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        return self.serialize_draft(draft)

    def update_mapping(
        self,
        draft: ExtractionDraft,
        mapping: ColumnMapping,
        current_user: User,
        db: Session,
    ) -> ExtractionDraftResponse:
        rows = self._get_reviewed_rows(draft)
        headers = self._get_column_headers(draft)
        validation = self._build_validation_summary(rows, headers, mapping)
        draft.mapped_fields_json = self._dump_json(mapping.model_dump())
        draft.validation_summary_json = self._dump_json(validation.model_dump())
        draft.status = "reviewed"
        draft.updated_by = current_user.id
        draft.updated_at = datetime.utcnow()
        self._record_edit(draft, current_user, "mapping.updated", {"mapping": mapping.model_dump()}, db)
        db.commit()
        db.refresh(draft)
        return self.serialize_draft(draft)

    def update_region(
        self,
        draft: ExtractionDraft,
        payload: ExtractionDraftRegionUpdateRequest,
        current_user: User,
        db: Session,
    ) -> ExtractionDraftResponse:
        rows = self._get_reviewed_rows(draft)
        headers = self._get_column_headers(draft)
        mapping = self._get_mapping(draft)

        header_row_index = payload.header_row_index
        if header_row_index is not None:
            header_row = self._find_row(rows, header_row_index)
            if header_row:
                normalized_headers = self.extraction_service._normalize_headers(header_row.cells)
                headers = normalized_headers
                draft.column_headers_json = self._dump_json(headers)
                mapping = self._realign_mapping_to_headers(mapping, headers)

        start = payload.table_start_row_index
        end = payload.table_end_row_index
        rows = self._apply_region_flags(rows, start, end)
        validation = self._build_validation_summary(rows, headers, mapping)

        draft.header_row_index = header_row_index
        draft.table_start_row_index = start
        draft.table_end_row_index = end
        draft.reviewed_rows_json = self._dump_json([row.model_dump() for row in rows])
        draft.mapped_fields_json = self._dump_json(mapping.model_dump())
        draft.validation_summary_json = self._dump_json(validation.model_dump())
        draft.status = "reviewed"
        draft.updated_by = current_user.id
        draft.updated_at = datetime.utcnow()
        self._record_edit(
            draft,
            current_user,
            "region.updated",
            {
                "header_row_index": header_row_index,
                "table_start_row_index": start,
                "table_end_row_index": end,
            },
            db,
        )
        db.commit()
        db.refresh(draft)
        return self.serialize_draft(draft)

    def update_rows(
        self,
        draft: ExtractionDraft,
        payload: ExtractionDraftRowsUpdateRequest,
        current_user: User,
        db: Session,
    ) -> ExtractionDraftResponse:
        rows = self._get_reviewed_rows(draft)
        headers = self._get_column_headers(draft)
        mapping = self._get_mapping(draft)
        row_by_index = {row.row_index: row for row in rows}

        for edit in payload.edits:
            row = row_by_index.get(edit.row_index)
            if not row:
                continue
            if edit.cells is not None:
                row.cells = list(edit.cells)
            if edit.row_type is not None:
                row.row_type = edit.row_type
            if edit.is_repeated_header is not None:
                row.is_repeated_header = edit.is_repeated_header
            if edit.is_within_selected_region is not None:
                row.is_within_selected_region = edit.is_within_selected_region
            row.warnings = self._row_warnings(row.cells, row.row_type, row.is_repeated_header)
            row.confidence = self._score_row_confidence(row.cells)

        rows = self._apply_region_flags(rows, draft.table_start_row_index, draft.table_end_row_index)
        validation = self._build_validation_summary(rows, headers, mapping)

        draft.reviewed_rows_json = self._dump_json([row.model_dump() for row in rows])
        draft.validation_summary_json = self._dump_json(validation.model_dump())
        draft.status = "reviewed"
        draft.updated_by = current_user.id
        draft.updated_at = datetime.utcnow()
        self._record_edit(
            draft,
            current_user,
            "rows.updated",
            {"edit_count": len(payload.edits)},
            db,
        )
        db.commit()
        db.refresh(draft)
        return self.serialize_draft(draft)

    def validate_draft(self, draft: ExtractionDraft) -> ExtractionDraftValidationSummary:
        return self._get_validation_summary(draft)

    def finalize_draft(
        self,
        draft: ExtractionDraft,
        session: UploadSession,
        current_user: User,
        db: Session,
    ) -> ExtractionDraftFinalizeResponse:
        rows = self._get_reviewed_rows(draft)
        headers = self._get_column_headers(draft)
        mapping = self._get_mapping(draft)
        validation = self._build_validation_summary(rows, headers, mapping)
        blocking_issues = [issue for issue in validation.issues if issue.severity == "blocking"]
        if blocking_issues:
            raise ValueError("Resolve blocking review issues before finalizing this PDF.")

        candidate_rows = [
            row
            for row in rows
            if row.is_within_selected_region and row.row_type == "transaction"
        ]
        raw_transactions: List[Dict[str, Any]] = []
        for row in candidate_rows:
            row_dict: Dict[str, Any] = {}
            for idx, header in enumerate(headers):
                row_dict[header] = row.cells[idx] if idx < len(row.cells) else None
            raw_transactions.append(row_dict)

        standardized = self.standardization_service.standardize(
            raw_transactions=raw_transactions,
            column_mapping=mapping,
            source=session.upload_source,
        )
        self._clear_existing_session_transactions(session, db)

        transaction_model = BankTransaction if session.upload_source == "bank" else BookTransaction
        for tx_data in standardized:
            tx = transaction_model(
                org_id=session.org_id,
                upload_session_id=session.id,
                trans_date=datetime.fromisoformat(tx_data["trans_date"]),
                narration=tx_data["narration"],
                reference=tx_data.get("reference"),
                amount=tx_data["amount"],
                status="unreconciled",
            )
            db.add(tx)

        session.status = "complete"
        session.error_message = None
        session.rows_extracted = len(rows)
        session.rows_standardized = len(standardized)
        session.completed_at = datetime.utcnow()

        draft.status = "finalized"
        draft.finalized_at = datetime.utcnow()
        draft.updated_by = current_user.id
        draft.updated_at = datetime.utcnow()
        draft.validation_summary_json = self._dump_json(validation.model_dump())
        self.standardization_service.save_pdf_template(
            org_id=str(session.org_id),
            file_name=session.file_name,
            file_source=session.upload_source,
            column_headers=headers,
            column_mapping=mapping,
            source_method=draft.source_method,
            metadata={
                "confidence": max(draft.confidence, 85),
                "header_row_index": draft.header_row_index,
                "table_start_row_index": draft.table_start_row_index,
                "table_end_row_index": draft.table_end_row_index,
                "validation_summary": validation.model_dump(),
            },
            db=db,
        )
        self._record_edit(
            draft,
            current_user,
            "draft.finalized",
            {"standardized_count": len(standardized)},
            db,
        )
        db.commit()
        db.refresh(draft)

        return ExtractionDraftFinalizeResponse(
            status="success",
            standardized_count=len(standardized),
            session_id=str(session.id),
            draft_id=draft.id,
            bucket_summaries=self._build_bucket_summaries(standardized),
        )

    def serialize_draft(self, draft: ExtractionDraft) -> ExtractionDraftResponse:
        return ExtractionDraftResponse(
            id=draft.id,
            upload_session_id=draft.upload_session_id,
            org_id=draft.org_id,
            version=draft.version,
            source_method=draft.source_method,
            confidence=draft.confidence,
            status=draft.status,
            column_headers=self._get_column_headers(draft),
            mapped_fields=self._get_mapping(draft),
            raw_rows=self._get_rows_from_json(draft.raw_rows_json),
            reviewed_rows=self._get_reviewed_rows(draft),
            header_row_index=draft.header_row_index,
            table_start_row_index=draft.table_start_row_index,
            table_end_row_index=draft.table_end_row_index,
            validation_summary=self._get_validation_summary(draft),
            created_at=draft.created_at,
            updated_at=draft.updated_at,
            finalized_at=draft.finalized_at,
        )

    def _build_rows(
        self,
        raw_data: List[List[Any]],
        column_headers: List[str],
    ) -> List[ExtractionDraftRow]:
        repeated_signatures: Dict[str, int] = {}
        normalized_rows = [
            self.extraction_service._normalize_row(list(row), len(column_headers))
            for row in raw_data
        ]
        for row in normalized_rows:
            signature = self._row_signature(row)
            repeated_signatures[signature] = repeated_signatures.get(signature, 0) + 1

        rows: List[ExtractionDraftRow] = []
        for idx, row in enumerate(normalized_rows):
            row_type = self._infer_row_type(row)
            repeated = repeated_signatures.get(self._row_signature(row), 0) > 1 and row_type == "header"
            rows.append(
                ExtractionDraftRow(
                    row_index=idx,
                    cells=row,
                    row_type="header" if repeated else row_type,
                    warnings=self._row_warnings(row, row_type, repeated),
                    confidence=self._score_row_confidence(row),
                    is_repeated_header=repeated,
                    is_within_selected_region=False,
                    provenance="extractor",
                )
            )

        table_header_index = self._detect_table_header_row_index(rows)
        if table_header_index is not None:
            for row in rows:
                if row.row_index == table_header_index:
                    row.row_type = "header"
                    row.is_repeated_header = False
                    row.warnings = self._row_warnings(row.cells, row.row_type, False)
                elif row.row_index < table_header_index and row.row_type in {"transaction", "unknown"}:
                    row.row_type = "footer"
                    row.warnings = self._row_warnings(row.cells, row.row_type, row.is_repeated_header)
        return rows

    def _infer_region(self, rows: List[ExtractionDraftRow]) -> Dict[str, Optional[int]]:
        header_index = self._detect_table_header_row_index(rows)
        transaction_rows = [
            row.row_index
            for row in rows
            if row.row_type == "transaction"
            and (header_index is None or row.row_index > header_index)
        ]
        if not transaction_rows and header_index is not None:
            transaction_rows = [row.row_index for row in rows if row.row_type == "transaction"]
        return {
            "start": transaction_rows[0] if transaction_rows else None,
            "end": transaction_rows[-1] if transaction_rows else None,
        }

    def _detect_table_header_row_index(self, rows: List[ExtractionDraftRow]) -> Optional[int]:
        if not rows:
            return None

        best_index: Optional[int] = None
        best_score = float("-inf")
        search_window = min(len(rows), 80)

        for idx in range(search_window):
            row = rows[idx]
            score = self.extraction_service._table_header_anchor_score(row.cells)
            if row.row_type == "transaction":
                score -= 3
            if idx + 1 < len(rows) and rows[idx + 1].row_type == "transaction":
                score += 2
            if idx + 2 < len(rows) and rows[idx + 2].row_type == "transaction":
                score += 1
            if score > best_score:
                best_score = score
                best_index = row.row_index

        if best_index is not None and best_score >= 8:
            return best_index
        return None

    def _apply_region_flags(
        self,
        rows: List[ExtractionDraftRow],
        start: Optional[int],
        end: Optional[int],
    ) -> List[ExtractionDraftRow]:
        if start is None and end is None:
            inferred = self._infer_region(rows)
            start = inferred["start"]
            end = inferred["end"]

        for row in rows:
            in_region = True
            if start is not None and row.row_index < start:
                in_region = False
            if end is not None and row.row_index > end:
                in_region = False
            row.is_within_selected_region = in_region and row.row_type != "deleted"
        return rows

    def _build_validation_summary(
        self,
        rows: List[ExtractionDraftRow],
        column_headers: List[str],
        mapping: ColumnMapping,
    ) -> ExtractionDraftValidationSummary:
        active_rows = [
            row
            for row in rows
            if row.is_within_selected_region and row.row_type not in {"deleted", "footer", "summary"}
        ]
        transaction_rows = [row for row in active_rows if row.row_type == "transaction"]
        issues: List[ExtractionDraftValidationIssue] = []

        def _resolve_cell(row: ExtractionDraftRow, header_name: Optional[str]) -> Any:
            if not header_name or header_name not in column_headers:
                return None
            idx = column_headers.index(header_name)
            return row.cells[idx] if idx < len(row.cells) else None

        date_ok = sum(
            1 for row in transaction_rows if self.extraction_service._value_looks_like_date(_resolve_cell(row, mapping.date))
        )
        narration_ok = sum(
            1
            for row in transaction_rows
            if str(_resolve_cell(row, mapping.narration) or "").strip()
        )
        debit_ok = sum(
            1
            for row in transaction_rows
            if self.extraction_service._parse_amount_value(_resolve_cell(row, mapping.debit)) is not None
        )
        credit_ok = sum(
            1
            for row in transaction_rows
            if self.extraction_service._parse_amount_value(_resolve_cell(row, mapping.credit)) is not None
        )
        amount_ok = sum(
            1
            for row in transaction_rows
            if (
                self.extraction_service._parse_amount_value(_resolve_cell(row, mapping.debit)) is not None
                or self.extraction_service._parse_amount_value(_resolve_cell(row, mapping.credit)) is not None
            )
        )

        duplicate_signatures: Dict[str, List[int]] = {}
        for row in transaction_rows:
            signature = self._transaction_signature(row, column_headers, mapping)
            duplicate_signatures.setdefault(signature, []).append(row.row_index)

        duplicate_rows = [
            indices
            for indices in duplicate_signatures.values()
            if len(indices) > 1 and signature_is_meaningful(indices)
        ]
        repeated_headers_in_region = [row.row_index for row in rows if row.is_repeated_header and row.is_within_selected_region]
        malformed_amount_rows = [
            row.row_index
            for row in transaction_rows
            if self.extraction_service._parse_amount_value(_resolve_cell(row, mapping.debit)) is None
            and self.extraction_service._parse_amount_value(_resolve_cell(row, mapping.credit)) is None
        ]
        impossible_date_rows = [
            row.row_index
            for row in transaction_rows
            if not self.extraction_service._value_looks_like_date(_resolve_cell(row, mapping.date))
        ]
        blank_narr_rows = [
            row.row_index for row in transaction_rows if not str(_resolve_cell(row, mapping.narration) or "").strip()
        ]
        exclusivity_rows = 0
        amount_present_rows = 0
        debit_total = Decimal("0")
        credit_total = Decimal("0")

        for row in transaction_rows:
            debit_val = self.extraction_service._parse_amount_value(_resolve_cell(row, mapping.debit))
            credit_val = self.extraction_service._parse_amount_value(_resolve_cell(row, mapping.credit))
            if debit_val is not None:
                debit_total += abs(debit_val)
            if credit_val is not None:
                credit_total += abs(credit_val)
            if debit_val is not None or credit_val is not None:
                amount_present_rows += 1
            if (debit_val is not None) ^ (credit_val is not None):
                exclusivity_rows += 1

        tx_count = len(transaction_rows)
        date_coverage = (date_ok / tx_count) if tx_count else 0.0
        narration_coverage = (narration_ok / tx_count) if tx_count else 0.0
        debit_coverage = (debit_ok / tx_count) if tx_count else 0.0
        credit_coverage = (credit_ok / tx_count) if tx_count else 0.0
        amount_coverage = (amount_ok / tx_count) if tx_count else 0.0
        exclusivity = (exclusivity_rows / amount_present_rows) if amount_present_rows else 0.0

        if tx_count == 0:
            issues.append(
                ExtractionDraftValidationIssue(
                    code="no_transactions",
                    severity="blocking",
                    message="No transaction rows are currently selected for finalization.",
                )
            )
        if date_coverage < 0.75 and tx_count:
            issues.append(
                ExtractionDraftValidationIssue(
                    code="date_coverage_low",
                    severity="blocking",
                    message="Date parse coverage is too low. Review the date column or selected rows.",
                    row_indices=impossible_date_rows[:25],
                )
            )
        if amount_coverage < 0.75 and tx_count:
            issues.append(
                ExtractionDraftValidationIssue(
                    code="amount_coverage_low",
                    severity="blocking",
                    message="Debit/Credit parsing is too weak. Review amount columns before finalizing.",
                    row_indices=malformed_amount_rows[:25],
                )
            )
        if repeated_headers_in_region:
            issues.append(
                ExtractionDraftValidationIssue(
                    code="repeated_headers_in_region",
                    severity="warning",
                    message="Some repeated header rows are still inside the selected transaction region.",
                    row_indices=repeated_headers_in_region[:25],
                )
            )
        if duplicate_rows:
            flattened = [row_idx for group in duplicate_rows for row_idx in group][:25]
            issues.append(
                ExtractionDraftValidationIssue(
                    code="duplicate_rows",
                    severity="warning",
                    message="Potential duplicate transactions were detected across the selected rows.",
                    row_indices=flattened,
                )
            )
        if blank_narr_rows:
            issues.append(
                ExtractionDraftValidationIssue(
                    code="blank_narration_rows",
                    severity="warning",
                    message="Some transaction rows still have blank narration values.",
                    row_indices=blank_narr_rows[:25],
                )
            )
        if exclusivity < 0.75 and amount_present_rows:
            issues.append(
                ExtractionDraftValidationIssue(
                    code="debit_credit_exclusivity_low",
                    severity="warning",
                    message="Debit/Credit exclusivity is weak. Review rows where both sides may be populated.",
                )
            )

        return ExtractionDraftValidationSummary(
            totals={
                "debit_total": round(float(debit_total), 2),
                "credit_total": round(float(credit_total), 2),
                "transaction_rows": tx_count,
                "selected_rows": len(active_rows),
            },
            parse_coverage={
                "date": round(date_coverage, 4),
                "narration": round(narration_coverage, 4),
                "debit": round(debit_coverage, 4),
                "credit": round(credit_coverage, 4),
                "amount": round(amount_coverage, 4),
                "debit_credit_exclusivity": round(exclusivity, 4),
            },
            suspicious_row_count=sum(1 for row in rows if row.warnings),
            issues=issues,
        )

    def _build_bucket_summaries(self, standardized: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
        debit_total = Decimal("0")
        credit_total = Decimal("0")
        debit_count = 0
        credit_count = 0
        for row in standardized:
            amount = Decimal(str(row.get("amount") or "0"))
            if amount < 0:
                debit_total += abs(amount)
                debit_count += 1
            elif amount > 0:
                credit_total += abs(amount)
                credit_count += 1
        return {
            "debit": {"count": debit_count, "total": round(float(debit_total), 2)},
            "credit": {"count": credit_count, "total": round(float(credit_total), 2)},
        }

    def _apply_template(
        self,
        rows: List[ExtractionDraftRow],
        column_headers: List[str],
        mapping: ColumnMapping,
        region: Dict[str, Optional[int]],
        template,
    ) -> tuple[ColumnMapping, Dict[str, Optional[int]], List[ExtractionDraftRow]]:
        try:
            template_mapping = ColumnMapping(**self._load_json(template.column_map, {}))
            mapping = self._realign_mapping_to_headers(template_mapping, column_headers)
        except Exception:
            pass

        rules = self._load_json(template.ai_rules, {})
        region = {
            "start": rules.get("table_start_row_index", region.get("start")),
            "end": rules.get("table_end_row_index", region.get("end")),
        }
        header_row_index = rules.get("header_row_index")
        if header_row_index is not None:
            header_row = self._find_row(rows, header_row_index)
            if header_row:
                header_row.row_type = "header"
                header_row.is_repeated_header = False
        rows = self._apply_region_flags(rows, region["start"], region["end"])
        return mapping, region, rows

    def _infer_row_type(self, row: List[Any]) -> str:
        joined = " ".join(str(cell or "").strip() for cell in row).strip().lower()
        if not joined:
            return "unknown"
        if self.extraction_service._looks_like_header(row):
            return "header"
        if re.search(r"\b(opening|closing|brought forward|carried forward|balance c/?f|balance b/?f|total)\b", joined):
            return "summary"
        if re.search(
            r"\b(page\s+\d+|generated\s+on|statement\s+(?:period|date|from|to)|branch|account number|customer)\b",
            joined,
        ):
            return "footer"
        if self.extraction_service._looks_like_data_row(row):
            return "transaction"
        return "unknown"

    def _row_warnings(self, row: List[Any], row_type: str, repeated: bool) -> List[str]:
        warnings: List[str] = []
        if repeated:
            warnings.append("Repeated header detected")
        if row_type == "summary":
            warnings.append("Looks like a summary/balance row")
        if row_type == "footer":
            warnings.append("Looks like a footer or metadata row")
        if row_type == "unknown":
            warnings.append("Row classification is uncertain")
        return warnings

    def _score_row_confidence(self, row: List[Any]) -> int:
        date_hits = sum(1 for cell in row if self.extraction_service._value_looks_like_date(cell))
        amount_hits = sum(1 for cell in row if self.extraction_service._value_looks_like_amount(cell))
        reference_hits = sum(1 for cell in row if self.extraction_service._value_looks_like_reference(cell))
        narration_hits = sum(1 for cell in row if self.extraction_service._value_looks_like_narration(cell))
        score = (date_hits * 30) + (amount_hits * 20) + (reference_hits * 15) + (narration_hits * 15)
        return max(5, min(100, score))

    def _find_row(self, rows: List[ExtractionDraftRow], row_index: int) -> Optional[ExtractionDraftRow]:
        for row in rows:
            if row.row_index == row_index:
                return row
        return None

    def _get_rows_from_json(self, value: str) -> List[ExtractionDraftRow]:
        loaded = self._load_json(value, [])
        return [ExtractionDraftRow(**row) for row in loaded]

    def _get_reviewed_rows(self, draft: ExtractionDraft) -> List[ExtractionDraftRow]:
        return self._get_rows_from_json(draft.reviewed_rows_json or "[]")

    def _get_column_headers(self, draft: ExtractionDraft) -> List[str]:
        return list(self._load_json(draft.column_headers_json, []))

    def _get_mapping(self, draft: ExtractionDraft) -> ColumnMapping:
        return ColumnMapping(**self._load_json(draft.mapped_fields_json, {}))

    def _get_validation_summary(self, draft: ExtractionDraft) -> ExtractionDraftValidationSummary:
        loaded = self._load_json(draft.validation_summary_json, {})
        return ExtractionDraftValidationSummary(**loaded)

    def _load_json(self, value: Optional[str], fallback: Any) -> Any:
        if not value:
            return fallback
        try:
            return json.loads(value)
        except Exception:
            return fallback

    def _dump_json(self, value: Any) -> str:
        return json.dumps(value, default=str)

    def _record_edit(
        self,
        draft: ExtractionDraft,
        current_user: User,
        action_type: str,
        payload: Dict[str, Any],
        db: Session,
    ) -> None:
        db.add(
            ExtractionDraftEdit(
                draft_id=draft.id,
                org_id=draft.org_id,
                action_type=action_type,
                payload_json=self._dump_json(payload),
                created_by=current_user.id,
            )
        )

    def _realign_mapping_to_headers(
        self,
        mapping: ColumnMapping,
        headers: List[str],
    ) -> ColumnMapping:
        original = mapping.model_dump()
        values = [mapping.date, mapping.narration, mapping.reference, mapping.debit, mapping.credit]
        resolved = []
        for idx, value in enumerate(values):
            if value and value in headers:
                resolved.append(value)
            elif idx < len(headers):
                resolved.append(headers[idx])
            else:
                resolved.append(None)
        return ColumnMapping(
            date=resolved[0] or headers[0],
            narration=resolved[1] or headers[min(1, len(headers) - 1)],
            reference=resolved[2] or headers[min(2, len(headers) - 1)],
            amount=original.get("amount"),
            debit=resolved[3],
            credit=resolved[4],
        )

    def _clear_existing_session_transactions(self, session: UploadSession, db: Session) -> None:
        transaction_model = BankTransaction if session.upload_source == "bank" else BookTransaction
        existing_transactions = db.query(transaction_model).filter(
            transaction_model.upload_session_id == session.id
        ).all()

        affected_match_group_ids = {
            tx.match_group_id for tx in existing_transactions if tx.match_group_id is not None
        }
        if affected_match_group_ids:
            db.query(BankTransaction).filter(
                BankTransaction.match_group_id.in_(affected_match_group_ids)
            ).update(
                {"match_group_id": None, "status": "unreconciled"},
                synchronize_session=False,
            )
            db.query(BookTransaction).filter(
                BookTransaction.match_group_id.in_(affected_match_group_ids)
            ).update(
                {"match_group_id": None, "status": "unreconciled"},
                synchronize_session=False,
            )
            db.query(MatchGroup).filter(
                MatchGroup.id.in_(affected_match_group_ids)
            ).delete(synchronize_session=False)

        db.query(transaction_model).filter(
            transaction_model.upload_session_id == session.id
        ).delete(synchronize_session=False)

    def _row_signature(self, row: List[Any]) -> str:
        return "|".join(str(cell or "").strip().lower() for cell in row)

    def _transaction_signature(
        self,
        row: ExtractionDraftRow,
        headers: List[str],
        mapping: ColumnMapping,
    ) -> str:
        row_dict: Dict[str, Any] = {}
        for idx, header in enumerate(headers):
            row_dict[header] = row.cells[idx] if idx < len(row.cells) else None
        return "|".join(
            [
                str(row_dict.get(mapping.date) or "").strip().lower(),
                str(row_dict.get(mapping.reference) or "").strip().lower(),
                str(row_dict.get(mapping.narration) or "").strip().lower(),
                str(row_dict.get(mapping.debit) or "").strip().lower(),
                str(row_dict.get(mapping.credit) or "").strip().lower(),
            ]
        )


def signature_is_meaningful(indices: List[int]) -> bool:
    return len(indices) > 1
