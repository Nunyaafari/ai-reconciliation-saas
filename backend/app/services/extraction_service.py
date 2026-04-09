import json
import hashlib
import importlib
from typing import Dict, List, Any, Optional
import logging
from app.schemas import ColumnMapping
from datetime import datetime, date
from io import BytesIO, StringIO
import csv
import re
from decimal import Decimal, InvalidOperation

from app.config import settings

logger = logging.getLogger(__name__)


def _optional_import(module_name: str):
    try:
        return importlib.import_module(module_name)
    except Exception:  # pragma: no cover - optional dependency at runtime
        return None


def _load_openpyxl():
    return _optional_import("openpyxl")


def _load_pdfplumber():
    return _optional_import("pdfplumber")


def _load_pdf2image_convert():
    module = _optional_import("pdf2image")
    return getattr(module, "convert_from_bytes", None) if module else None


def _load_pytesseract():
    return _optional_import("pytesseract")


def _load_pypdf_reader():
    module = _optional_import("pypdf")
    return getattr(module, "PdfReader", None) if module else None


def _load_azure_document_client():
    azure_doc_module = _optional_import("azure.ai.documentintelligence")
    azure_core_module = _optional_import("azure.core.credentials")
    if not azure_doc_module or not azure_core_module:
        return None, None
    return (
        getattr(azure_doc_module, "DocumentIntelligenceClient", None),
        getattr(azure_core_module, "AzureKeyCredential", None),
    )


class ExtractionService:
    """Handles PDF/Excel extraction and AI column mapping guessing."""

    PREVIEW_PDF_PAGE_LIMIT = 3
    PREVIEW_ROW_LIMIT = 80

    def extract(
        self,
        file_content: bytes,
        file_type: str,
        org_id: str,
        preview_mode: bool = False,
    ) -> Dict[str, Any]:
        """
        Extract data from file.
        PDFs use Azure AI Document Intelligence when configured.
        """

        if file_type == "pdf":
            return self._extract_pdf(file_content, org_id, preview_mode=preview_mode)
        elif file_type == "xlsx":
            return self._extract_xlsx(file_content, org_id)
        elif file_type == "csv":
            return self._extract_csv(file_content, org_id)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    def _extract_pdf(
        self,
        file_content: bytes,
        org_id: str,
        preview_mode: bool = False,
    ) -> Dict[str, Any]:
        """
        Extract tables from PDF using Azure AI Document Intelligence.

        Requires AZURE_AI_KEY and AZURE_AI_ENDPOINT.
        """
        if preview_mode:
            fast_preview = self._extract_pdf_local(
                file_content,
                org_id,
                max_pages=self.PREVIEW_PDF_PAGE_LIMIT,
                row_limit=self.PREVIEW_ROW_LIMIT,
            )
            if fast_preview.get("raw_data"):
                fast_preview["method"] = f"{fast_preview.get('method', 'pdf-local')}-preview"
                return fast_preview
            logger.info(
                "Fast PDF preview returned no rows for org %s; retrying full extraction path",
                org_id,
            )

        local_fallback = None

        if self._azure_configured():
            try:
                azure_payload = self._extract_pdf_azure(file_content, org_id)
                local_fallback = self._extract_pdf_local(file_content, org_id)
                return self._pick_best_pdf_payload(azure_payload, local_fallback)
            except Exception as e:
                logger.warning(
                    "Azure PDF extraction failed, falling back to local parser: %s",
                    str(e),
                )

        return self._extract_pdf_local(file_content, org_id)

    def _extract_pdf_azure(self, file_content: bytes, org_id: str) -> Dict[str, Any]:
        DocumentIntelligenceClient, AzureKeyCredential = _load_azure_document_client()
        if DocumentIntelligenceClient is None:
            raise ValueError("azure-ai-documentintelligence is required for PDF extraction")

        logger.info(f"Extracting PDF for org {org_id} via Azure Document Intelligence")

        client = DocumentIntelligenceClient(
            endpoint=settings.AZURE_AI_ENDPOINT,
            credential=AzureKeyCredential(settings.AZURE_AI_KEY),
        )

        poller = client.begin_analyze_document("prebuilt-layout", body=BytesIO(file_content))
        result = poller.result()

        tables = result.tables or []
        if not tables:
            logger.warning("No tables detected in PDF (Azure)")
            return {"raw_data": [], "column_headers": [], "confidence": 0}

        combined_rows = self._merge_table_cells(tables)

        if not combined_rows:
            return {"raw_data": [], "column_headers": [], "confidence": 0}

        payload = self._rows_to_payload(combined_rows, confidence=88)
        payload["method"] = "azure"
        return payload

    def _extract_pdf_local(
        self,
        file_content: bytes,
        org_id: str,
        max_pages: Optional[int] = None,
        row_limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        pdfplumber = _load_pdfplumber()
        if pdfplumber is None:
            raise ValueError("pdfplumber is required for local PDF extraction")

        logger.info(f"Extracting PDF for org {org_id} via pdfplumber")

        tables: List[List[List[Any]]] = []
        text_rows: List[List[str]] = []
        text_lines: List[str] = []

        with pdfplumber.open(BytesIO(file_content)) as pdf:
            pages = pdf.pages[:max_pages] if max_pages else pdf.pages
            for page in pages:
                page_tables: List[List[List[Any]]] = []
                for settings in self._pdf_table_settings():
                    extracted = page.extract_tables(settings)
                    if extracted:
                        page_tables.extend(extracted)

                if page_tables:
                    tables.extend(page_tables)
                    if row_limit and self._estimated_table_rows(tables) >= row_limit:
                        break

                page_text = page.extract_text(x_tolerance=2, y_tolerance=2, layout=True) or ""
                for line in page_text.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    text_lines.append(line)
                    parts = self._split_pdf_text_line(line)
                    if len(parts) >= 3:
                        text_rows.append(parts)
                        if row_limit and len(text_rows) >= row_limit:
                            break
                if row_limit and len(text_rows) >= row_limit:
                    break

        table_payload = None
        text_payload = None
        structured_statement_payload = None

        if tables:
            combined_rows = self._merge_local_tables(tables)
            if text_rows and self._should_merge_text_rows(combined_rows):
                combined_rows = self._merge_table_and_text_rows(
                    combined_rows,
                    text_rows,
                )
            if combined_rows:
                payload = self._rows_to_payload(
                    self._limit_rows(combined_rows, row_limit),
                    confidence=72,
                )
                payload["method"] = "pdfplumber-table"
                table_payload = payload

        if text_rows:
            payload = self._rows_to_payload(
                self._limit_rows(text_rows, row_limit),
                confidence=60,
            )
            payload["method"] = "pdfplumber-text"
            text_payload = payload

        pypdf_lines = self._extract_text_lines_with_pypdf(
            file_content=file_content,
            max_pages=max_pages,
            row_limit=row_limit,
        )
        structured_statement_rows_pdfplumber = self._parse_structured_bank_statement_lines(
            text_lines=text_lines,
            row_limit=row_limit,
        )
        structured_statement_rows_pypdf = self._parse_structured_bank_statement_lines(
            text_lines=pypdf_lines,
            row_limit=row_limit,
        )
        structured_statement_rows = (
            structured_statement_rows_pypdf
            if len(structured_statement_rows_pypdf) > len(structured_statement_rows_pdfplumber)
            else structured_statement_rows_pdfplumber
        )
        if structured_statement_rows:
            payload = self._rows_to_payload(
                self._limit_rows(structured_statement_rows, row_limit),
                confidence=92,
            )
            payload["method"] = (
                "pypdf-statement"
                if structured_statement_rows is structured_statement_rows_pypdf
                else "pdfplumber-statement"
            )
            structured_statement_payload = payload

        if structured_statement_payload:
            structured_headers = [
                str(header).strip().lower()
                for header in (structured_statement_payload.get("column_headers") or [])
            ]
            structured_rows = structured_statement_payload.get("raw_data") or []
            has_core_columns = all(
                any(keyword in header for header in structured_headers)
                for keyword in ("date", "reference", "debit", "credit")
            )
            if has_core_columns and len(structured_rows) >= 10:
                return structured_statement_payload

        if structured_statement_payload and table_payload:
            return self._pick_best_pdf_payload(structured_statement_payload, table_payload)
        if structured_statement_payload and text_payload:
            return self._pick_best_pdf_payload(structured_statement_payload, text_payload)
        if structured_statement_payload:
            return structured_statement_payload
        if table_payload and text_payload:
            return self._pick_best_pdf_payload(table_payload, text_payload)
        if table_payload:
            return table_payload
        if text_payload:
            return text_payload

        if self._ocr_available():
            ocr_payload = self._extract_pdf_ocr(
                file_content,
                org_id,
                max_pages=max_pages,
                row_limit=row_limit,
            )
            if ocr_payload["raw_data"]:
                return ocr_payload

        logger.warning("No tables or parsable text found in PDF (local/OCR)")
        return {"raw_data": [], "column_headers": [], "confidence": 0}

    def _extract_xlsx(self, file_content: bytes, org_id: str) -> Dict[str, Any]:
        """Extract tables from Excel using openpyxl."""
        openpyxl = _load_openpyxl()
        if openpyxl is None:
            raise ValueError("openpyxl is required for XLSX extraction")

        logger.info(f"Extracting XLSX for org {org_id}")
        wb = openpyxl.load_workbook(BytesIO(file_content), data_only=True)
        ws = wb.active

        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return {"raw_data": [], "column_headers": [], "confidence": 0}

        normalized_rows = [list(row) for row in rows if any(cell not in (None, "") for cell in row)]
        column_headers, data_rows = self._split_rows_with_headers(normalized_rows)
        raw_data = [self._normalize_row(list(r), len(column_headers)) for r in data_rows]
        raw_data, column_headers = self._ensure_min_columns(raw_data, column_headers)
        column_headers = self._refine_headers_from_samples(raw_data, column_headers)

        return {
            "raw_data": raw_data,
            "column_headers": column_headers,
            "confidence": 90,
            "method": "xlsx",
        }

    def _extract_csv(self, file_content: bytes, org_id: str) -> Dict[str, Any]:
        """Extract from CSV using Python's csv module."""
        logger.info(f"Extracting CSV for org {org_id}")

        text = self._decode_bytes(file_content)
        reader = csv.reader(StringIO(text))
        rows = [row for row in reader if any((cell or "").strip() for cell in row)]

        if not rows:
            return {"raw_data": [], "column_headers": [], "confidence": 0}

        column_headers, data_rows = self._split_rows_with_headers(rows)
        raw_data = [self._normalize_row(row, len(column_headers)) for row in data_rows]
        raw_data, column_headers = self._ensure_min_columns(raw_data, column_headers)
        column_headers = self._refine_headers_from_samples(raw_data, column_headers)

        return {
            "raw_data": raw_data,
            "column_headers": column_headers,
            "confidence": 85,
            "method": "csv",
        }

    def guess_column_mapping(
        self,
        raw_data: List[List[str]],
        org_id: str,
        column_headers: Optional[List[str]] = None,
        upload_source: Optional[str] = None,
    ) -> ColumnMapping:
        """
        Use LLM to guess which columns are Date, Narration, Reference, Amount.

        Production implementation would:
        1. Send first 5 rows to GPT-4o-mini
        2. Parse response to identify columns
        3. Return mapping

        For MVP: Use heuristics
        """
        headers = column_headers or []
        if not headers and raw_data:
            headers = self._default_headers(len(raw_data[0]))

        if not raw_data or len(headers) < 4:
            raise ValueError("Need at least 4 columns")

        header_labels = [str(h).strip() for h in headers]

        if upload_source in {"bank", "book"}:
            statement_mapping = self._guess_bank_statement_mapping(header_labels, raw_data)
            if statement_mapping:
                return statement_mapping

        date_header = self._match_header(
            header_labels,
            ["date", "dt", "value date", "posting date", "transaction date"],
        )
        narration_header = self._match_header(
            header_labels,
            [
                "narr",
                "desc",
                "details",
                "memo",
                "remark",
                "remarks",
                "particular",
                "transaction description",
                "description",
            ],
        )
        reference_header = self._match_header(
            header_labels,
            ["ref", "reference", "cheque", "check", "chq", "invoice", "document"],
        )
        debit_header = self._match_header(
            header_labels,
            ["debit", "dr", "withdrawal", "withdraw", "paid out", "payment", "charge"],
        )
        credit_header = self._match_header(
            header_labels,
            ["credit", "cr", "deposit", "paid in", "receipt", "received"],
        )

        used_headers = {
            header
            for header in [date_header, narration_header, reference_header, debit_header, credit_header]
            if header
        }

        best_date = self._best_header_by_rule(
            header_labels,
            raw_data,
            self._value_looks_like_date,
        )
        if not date_header:
            date_header = best_date or header_labels[0]

        if date_header:
            used_headers.add(date_header)

        if not reference_header:
            reference_header = self._best_header_by_rule(
                header_labels,
                raw_data,
                self._value_looks_like_reference,
                exclude={date_header} if date_header else set(),
            )

        if not narration_header:
            narration_header = self._best_header_by_rule(
                header_labels,
                raw_data,
                self._value_looks_like_narration,
                exclude={date_header, reference_header} - {None},
            )

        inferred_debit, inferred_credit = self._infer_debit_credit_headers(
            header_labels,
            raw_data,
            debit_header=debit_header,
            credit_header=credit_header,
        )
        debit_header = debit_header or inferred_debit
        credit_header = credit_header or inferred_credit

        distinct_headers = set()

        def _assign_unique(primary: Optional[str], fallback_rule, fallback_default: str) -> str:
            candidate = primary
            if candidate and candidate not in distinct_headers:
                distinct_headers.add(candidate)
                return candidate

            fallback = self._best_header_by_rule(
                header_labels,
                raw_data,
                fallback_rule,
                exclude=distinct_headers,
            )
            if fallback and fallback not in distinct_headers:
                distinct_headers.add(fallback)
                return fallback

            for header in header_labels:
                if header not in distinct_headers:
                    distinct_headers.add(header)
                    return header
            return fallback_default

        date_header = _assign_unique(date_header, self._value_looks_like_date, header_labels[0])
        reference_header = _assign_unique(
            reference_header,
            self._value_looks_like_reference,
            header_labels[1 if len(header_labels) > 1 else 0],
        )
        narration_header = _assign_unique(
            narration_header,
            self._value_looks_like_narration,
            header_labels[2 if len(header_labels) > 2 else 0],
        )

        remaining_amount_headers = [
            header for header in header_labels if header not in {date_header, reference_header, narration_header}
        ]
        if not debit_header and remaining_amount_headers:
            debit_header = remaining_amount_headers[0]
        if not credit_header:
            for header in remaining_amount_headers:
                if header != debit_header:
                    credit_header = header
                    break

        return ColumnMapping(
            date=date_header,
            narration=narration_header,
            reference=reference_header,
            amount=None,
            debit=debit_header,
            credit=credit_header,
        )

    def _guess_bank_statement_mapping(
        self,
        headers: List[str],
        raw_data: List[List[Any]],
    ) -> Optional[ColumnMapping]:
        if not headers or not raw_data:
            return None

        bank_sample_size = None
        sparse_amount_threshold = 0.02

        date_keywords = ["date", "value date", "posting date", "transaction date", "dt"]
        reference_keywords = ["reference", "ref", "cheque", "check", "chq", "document", "txn ref"]
        narration_keywords = [
            "description",
            "transaction description",
            "narration",
            "narrative",
            "details",
            "memo",
            "remark",
            "remarks",
            "particular",
            "particulars",
        ]
        debit_keywords = ["debit", "dr", "withdrawal", "withdraw", "paid out", "payment", "charge"]
        credit_keywords = ["credit", "cr", "deposit", "paid in", "receipt", "received"]

        date_idx = self._find_explicit_header_index(headers, date_keywords)
        date_idx = self._best_header_index_for_field(
            headers=headers,
            raw_data=raw_data,
            header_keywords=date_keywords,
            sample_rule=self._value_looks_like_date,
            sample_size=bank_sample_size,
            non_empty_threshold=0.05,
        ) if date_idx is None else date_idx
        if date_idx is None:
            return None

        used_indices = {date_idx}

        reference_idx = self._find_explicit_header_index(
            headers,
            reference_keywords,
            exclude=used_indices,
        )
        narration_idx = self._find_explicit_header_index(
            headers,
            narration_keywords,
            exclude=used_indices,
        )
        explicit_debit_idx = self._find_explicit_header_index(
            headers,
            debit_keywords,
            exclude=used_indices,
        )
        explicit_credit_idx = self._find_explicit_header_index(
            headers,
            credit_keywords,
            exclude=used_indices | ({explicit_debit_idx} if explicit_debit_idx is not None else set()),
        )

        if explicit_debit_idx is not None:
            debit_amount_score = self._column_fit_score(
                raw_data,
                explicit_debit_idx,
                self._value_looks_like_amount,
                sample_size=None,
            )
            debit_non_empty_ratio = self._column_non_empty_ratio(
                raw_data,
                explicit_debit_idx,
                sample_size=None,
            )
            if debit_amount_score < 0.5 or debit_non_empty_ratio < sparse_amount_threshold:
                explicit_debit_idx = None

        if explicit_credit_idx is not None:
            credit_amount_score = self._column_fit_score(
                raw_data,
                explicit_credit_idx,
                self._value_looks_like_amount,
                sample_size=None,
            )
            credit_non_empty_ratio = self._column_non_empty_ratio(
                raw_data,
                explicit_credit_idx,
                sample_size=None,
            )
            if credit_amount_score < 0.5 or credit_non_empty_ratio < sparse_amount_threshold:
                explicit_credit_idx = None

        explicit_debit_header = headers[explicit_debit_idx] if explicit_debit_idx is not None else None
        explicit_credit_header = headers[explicit_credit_idx] if explicit_credit_idx is not None else None
        debit_header, credit_header = self._infer_debit_credit_headers(
            headers,
            raw_data,
            debit_header=explicit_debit_header,
            credit_header=explicit_credit_header,
            sample_size=bank_sample_size,
            non_empty_threshold=sparse_amount_threshold,
        )
        debit_idx = headers.index(debit_header) if debit_header in headers else None
        credit_idx = headers.index(credit_header) if credit_header in headers else None

        if debit_idx is not None:
            used_indices.add(debit_idx)
        if credit_idx is not None:
            used_indices.add(credit_idx)

        if reference_idx is None:
            reference_idx = self._best_header_index_for_field(
                headers=headers,
                raw_data=raw_data,
                header_keywords=reference_keywords,
                sample_rule=self._value_looks_like_reference,
                exclude=used_indices,
                sample_size=bank_sample_size,
                non_empty_threshold=0.05,
            )
        if reference_idx is not None:
            used_indices.add(reference_idx)

        if narration_idx is None:
            narration_idx = self._best_header_index_for_field(
                headers=headers,
                raw_data=raw_data,
                header_keywords=narration_keywords,
                sample_rule=self._value_looks_like_narration,
                exclude=used_indices,
                sample_size=bank_sample_size,
                non_empty_threshold=0.05,
            )

        if narration_idx is None:
            narration_idx = self._best_header_index_for_field(
                headers=headers,
                raw_data=raw_data,
                header_keywords=["description", "narration", "details", "memo"],
                sample_rule=self._value_looks_like_narration,
                sample_size=bank_sample_size,
                non_empty_threshold=0.05,
            )
            if narration_idx in {date_idx, reference_idx, debit_idx, credit_idx}:
                narration_idx = None

        if narration_idx is None:
            return None

        if reference_idx is None:
            reference_idx = self._best_header_index_for_field(
                headers=headers,
                raw_data=raw_data,
                header_keywords=["reference", "ref", "document"],
                sample_rule=self._value_looks_like_reference,
                exclude={date_idx, narration_idx, debit_idx, credit_idx} - {None},
                sample_size=bank_sample_size,
                non_empty_threshold=0.05,
            )

        if debit_idx is None or credit_idx is None:
            amount_candidates = self._rank_amount_columns(
                headers,
                raw_data,
                exclude={date_idx, narration_idx, reference_idx} - {None},
                sample_size=bank_sample_size,
                non_empty_threshold=sparse_amount_threshold,
            )
            if debit_idx is None and amount_candidates:
                debit_idx = amount_candidates[0]
            if credit_idx is None:
                for candidate_idx in amount_candidates:
                    if candidate_idx != debit_idx:
                        credit_idx = candidate_idx
                        break

        indices = [date_idx, narration_idx, reference_idx, debit_idx, credit_idx]
        if any(idx is None for idx in indices):
            return None
        if len(set(indices)) != len(indices):
            return None

        return ColumnMapping(
            date=headers[date_idx],
            narration=headers[narration_idx],
            reference=headers[reference_idx],
            amount=None,
            debit=headers[debit_idx],
            credit=headers[credit_idx],
        )

    def _match_header(self, headers: List[str], keywords: List[str]) -> Optional[str]:
        for header in headers:
            h = header.lower().strip()
            normalized = re.sub(r"[^a-z0-9]+", " ", h)
            tokens = {token for token in normalized.split() if token}
            if any(
                keyword in tokens if len(keyword) <= 2 else keyword in h
                for keyword in keywords
            ):
                return header
        return None

    def _header_keyword_score(self, header: str, keywords: List[str]) -> float:
        h = header.lower().strip()
        normalized = re.sub(r"[^a-z0-9]+", " ", h)
        tokens = {token for token in normalized.split() if token}
        score = 0.0

        for keyword in keywords:
            keyword = keyword.lower().strip()
            if not keyword:
                continue
            if len(keyword) <= 2:
                if keyword in tokens:
                    score = max(score, 1.0)
            elif keyword == h:
                score = max(score, 1.0)
            elif keyword in h:
                score = max(score, 0.8)

        return score

    def _best_header_index_for_field(
        self,
        headers: List[str],
        raw_data: List[List[Any]],
        header_keywords: List[str],
        sample_rule,
        exclude: Optional[set[int]] = None,
        sample_size: Optional[int] = 12,
        non_empty_threshold: float = 0.15,
    ) -> Optional[int]:
        exclude = exclude or set()
        best_idx = None
        best_score = -1.0

        for idx, header in enumerate(headers):
            if idx in exclude:
                continue

            sample_score = self._column_fit_score(
                raw_data,
                idx,
                sample_rule,
                sample_size=sample_size,
            )
            non_empty_ratio = self._column_non_empty_ratio(
                raw_data,
                idx,
                sample_size=sample_size,
            )
            keyword_score = self._header_keyword_score(header, header_keywords)
            combined = (sample_score * 0.72) + (keyword_score * 0.28)

            if sample_score < 0.2 and keyword_score < 0.8:
                continue
            if non_empty_ratio < non_empty_threshold:
                continue

            if combined > best_score:
                best_idx = idx
                best_score = combined

        return best_idx

    def _rank_amount_columns(
        self,
        headers: List[str],
        raw_data: List[List[Any]],
        exclude: Optional[set[int]] = None,
        sample_size: Optional[int] = 12,
        non_empty_threshold: float = 0.15,
    ) -> List[int]:
        exclude = exclude or set()
        ranked: List[tuple[int, float]] = []
        for idx, header in enumerate(headers):
            if idx in exclude:
                continue
            if "balance" in header.lower():
                continue
            amount_score = self._column_fit_score(
                raw_data,
                idx,
                self._value_looks_like_amount,
                sample_size=sample_size,
            )
            non_empty_ratio = self._column_non_empty_ratio(
                raw_data,
                idx,
                sample_size=sample_size,
            )
            if amount_score < 0.6 or non_empty_ratio < non_empty_threshold:
                continue
            ranked.append((idx, (amount_score * 0.75) + (non_empty_ratio * 0.25)))

        ranked.sort(key=lambda item: (-item[1], item[0]))
        return [idx for idx, _ in ranked]

    def _best_header_by_rule(
        self,
        headers: List[str],
        raw_data: List[List[Any]],
        rule,
        exclude: Optional[set[str]] = None,
    ) -> Optional[str]:
        exclude = exclude or set()
        best_header = None
        best_score = -1.0

        for idx, header in enumerate(headers):
            if header in exclude:
                continue
            score = self._column_fit_score(raw_data, idx, rule)
            if score > best_score:
                best_header = header
                best_score = score

        return best_header

    def _column_fit_score(
        self,
        raw_data: List[List[Any]],
        column_idx: int,
        rule,
        sample_size: Optional[int] = 12,
    ) -> float:
        values = []
        for row in self._sample_rows(raw_data, sample_size):
            if column_idx >= len(row):
                continue
            value = row[column_idx]
            if value is None or str(value).strip() == "":
                continue
            values.append(value)

        if not values:
            return 0.0

        passed = sum(1 for value in values if rule(value))
        return passed / len(values)

    def _sample_rows(
        self,
        raw_data: List[List[Any]],
        sample_size: Optional[int] = 12,
    ) -> List[List[Any]]:
        if sample_size is None or sample_size <= 0:
            return raw_data
        return raw_data[:sample_size]

    def _infer_debit_credit_headers(
        self,
        headers: List[str],
        raw_data: List[List[Any]],
        debit_header: Optional[str] = None,
        credit_header: Optional[str] = None,
        sample_size: Optional[int] = 12,
        non_empty_threshold: float = 0.15,
    ) -> tuple[Optional[str], Optional[str]]:
        if debit_header and credit_header:
            return debit_header, credit_header

        explicit_headers = {header for header in [debit_header, credit_header] if header}
        amount_candidates = []

        for idx, header in enumerate(headers):
            amount_ratio = self._column_fit_score(
                raw_data,
                idx,
                self._value_looks_like_amount,
                sample_size=sample_size,
            )
            non_empty_ratio = self._column_non_empty_ratio(
                raw_data,
                idx,
                sample_size=sample_size,
            )
            if header not in explicit_headers and (
                amount_ratio < 0.6 or non_empty_ratio < non_empty_threshold
            ):
                continue
            amount_candidates.append(
                {
                    "idx": idx,
                    "header": header,
                    "amount_ratio": amount_ratio,
                    "non_empty_ratio": non_empty_ratio,
                }
            )

        balance_header = self._match_header(headers, ["balance", "running balance", "available balance"])
        if balance_header:
            amount_candidates = [
                candidate
                for candidate in amount_candidates
                if candidate["header"] != balance_header
            ]

        if len(amount_candidates) > 2:
            densest = max(amount_candidates, key=lambda candidate: candidate["non_empty_ratio"])
            if densest["non_empty_ratio"] >= 0.85 and densest["header"] not in explicit_headers:
                amount_candidates = [
                    candidate for candidate in amount_candidates if candidate["header"] != densest["header"]
                ]

        if debit_header and not credit_header:
            debit_candidate = next(
                (candidate for candidate in amount_candidates if candidate["header"] == debit_header),
                None,
            )
            if debit_candidate:
                best_credit = None
                best_score = -1.0
                for candidate in amount_candidates:
                    if candidate["header"] == debit_header:
                        continue
                    exclusivity = self._pair_exclusivity_score(
                        raw_data,
                        debit_candidate["idx"],
                        candidate["idx"],
                        sample_size=sample_size,
                    )
                    coverage = self._pair_coverage_score(
                        raw_data,
                        debit_candidate["idx"],
                        candidate["idx"],
                        sample_size=sample_size,
                    )
                    score = (exclusivity * 0.7) + (coverage * 0.3)
                    if score > best_score:
                        best_credit = candidate["header"]
                        best_score = score
                if best_credit:
                    return debit_header, best_credit

        if credit_header and not debit_header:
            credit_candidate = next(
                (candidate for candidate in amount_candidates if candidate["header"] == credit_header),
                None,
            )
            if credit_candidate:
                best_debit = None
                best_score = -1.0
                for candidate in amount_candidates:
                    if candidate["header"] == credit_header:
                        continue
                    exclusivity = self._pair_exclusivity_score(
                        raw_data,
                        candidate["idx"],
                        credit_candidate["idx"],
                        sample_size=sample_size,
                    )
                    coverage = self._pair_coverage_score(
                        raw_data,
                        candidate["idx"],
                        credit_candidate["idx"],
                        sample_size=sample_size,
                    )
                    score = (exclusivity * 0.7) + (coverage * 0.3)
                    if score > best_score:
                        best_debit = candidate["header"]
                        best_score = score
                if best_debit:
                    return best_debit, credit_header

        if len(amount_candidates) >= 2:
            best_pair = None
            best_score = -1.0

            for left_idx in range(len(amount_candidates)):
                for right_idx in range(left_idx + 1, len(amount_candidates)):
                    left = amount_candidates[left_idx]
                    right = amount_candidates[right_idx]
                    exclusivity = self._pair_exclusivity_score(
                        raw_data,
                        left["idx"],
                        right["idx"],
                        sample_size=sample_size,
                    )
                    coverage = self._pair_coverage_score(
                        raw_data,
                        left["idx"],
                        right["idx"],
                        sample_size=sample_size,
                    )
                    order_bonus = 0.05 if left["idx"] < right["idx"] else 0
                    score = (exclusivity * 0.7) + (coverage * 0.3) + order_bonus
                    if score > best_score:
                        best_score = score
                        best_pair = (left, right)

            if best_pair:
                left, right = best_pair
                inferred_debit, inferred_credit = self._orient_amount_pair(
                    left["header"],
                    right["header"],
                    left["idx"],
                    right["idx"],
                )
                return debit_header or inferred_debit, credit_header or inferred_credit

        if not debit_header and amount_candidates:
            debit_header = sorted(amount_candidates, key=lambda candidate: candidate["idx"])[0]["header"]

        if not credit_header:
            for candidate in sorted(amount_candidates, key=lambda item: item["idx"]):
                if candidate["header"] != debit_header:
                    credit_header = candidate["header"]
                    break

        return debit_header, credit_header

    def _orient_amount_pair(
        self,
        left_header: str,
        right_header: str,
        left_idx: int,
        right_idx: int,
    ) -> tuple[str, str]:
        left_lower = left_header.lower()
        right_lower = right_header.lower()

        left_is_debit = any(token in left_lower for token in ["debit", "dr", "withdraw", "payment", "charge"])
        right_is_debit = any(token in right_lower for token in ["debit", "dr", "withdraw", "payment", "charge"])
        left_is_credit = any(token in left_lower for token in ["credit", "cr", "deposit", "receipt", "received"])
        right_is_credit = any(token in right_lower for token in ["credit", "cr", "deposit", "receipt", "received"])

        if left_is_debit and not right_is_debit:
            return left_header, right_header
        if right_is_debit and not left_is_debit:
            return right_header, left_header
        if left_is_credit and not right_is_credit:
            return right_header, left_header
        if right_is_credit and not left_is_credit:
            return left_header, right_header

        # Many statements present Credit before Debit.
        if left_idx < right_idx:
            return right_header, left_header
        return left_header, right_header

    def _column_non_empty_ratio(
        self,
        raw_data: List[List[Any]],
        column_idx: int,
        sample_size: Optional[int] = 12,
    ) -> float:
        sample_rows = self._sample_rows(raw_data, sample_size)
        if not sample_rows:
            return 0.0

        filled = 0
        total = 0
        for row in sample_rows:
            if column_idx >= len(row):
                continue
            total += 1
            if row[column_idx] is not None and str(row[column_idx]).strip() != "":
                filled += 1

        return (filled / total) if total else 0.0

    def _pair_exclusivity_score(
        self,
        raw_data: List[List[Any]],
        left_idx: int,
        right_idx: int,
        sample_size: Optional[int] = 12,
    ) -> float:
        sample_rows = self._sample_rows(raw_data, sample_size)
        if not sample_rows:
            return 0.0

        exclusive_rows = 0
        considered_rows = 0
        for row in sample_rows:
            left_has = left_idx < len(row) and row[left_idx] not in (None, "")
            right_has = right_idx < len(row) and row[right_idx] not in (None, "")
            if not left_has and not right_has:
                continue
            considered_rows += 1
            if left_has ^ right_has:
                exclusive_rows += 1

        return (exclusive_rows / considered_rows) if considered_rows else 0.0

    def _pair_coverage_score(
        self,
        raw_data: List[List[Any]],
        left_idx: int,
        right_idx: int,
        sample_size: Optional[int] = 12,
    ) -> float:
        sample_rows = self._sample_rows(raw_data, sample_size)
        if not sample_rows:
            return 0.0

        covered_rows = 0
        for row in sample_rows:
            left_has = left_idx < len(row) and row[left_idx] not in (None, "")
            right_has = right_idx < len(row) and row[right_idx] not in (None, "")
            if left_has or right_has:
                covered_rows += 1

        return covered_rows / len(sample_rows)

    def _find_explicit_header_index(
        self,
        headers: List[str],
        aliases: List[str],
        exclude: Optional[set[int]] = None,
    ) -> Optional[int]:
        exclude = exclude or set()
        best_idx = None
        best_score = -1.0

        for idx, header in enumerate(headers):
            if idx in exclude:
                continue
            score = self._header_keyword_score(header, aliases)
            if score > best_score:
                best_idx = idx
                best_score = score

        if best_score >= 0.8:
            return best_idx
        return None

    def _contains_any_keyword(self, text: str, keywords: List[str]) -> bool:
        lowered = text.lower()
        normalized = re.sub(r"[^a-z0-9]+", " ", lowered)
        tokens = {token for token in normalized.split() if token}
        for keyword in keywords:
            keyword_normalized = re.sub(r"[^a-z0-9]+", " ", keyword.lower()).strip()
            if not keyword_normalized:
                continue
            keyword_tokens = keyword_normalized.split()
            if len(keyword_tokens) == 1 and len(keyword_tokens[0]) <= 2:
                if keyword_tokens[0] in tokens:
                    return True
                continue
            if keyword_normalized in lowered:
                return True
        return False

    def _looks_like_statement_metadata_row(self, row: List[Any]) -> bool:
        joined = " ".join(str(cell or "").strip() for cell in row).strip().lower()
        if not joined:
            return False
        metadata_patterns = [
            r"\baccount\s*(?:no|number)\b",
            r"\bcustomer\b",
            r"\bbranch\b",
            r"\bsort\s*code\b",
            r"\biban\b",
            r"\bswift\b",
            r"\bstatement\s*(?:period|date|from|to)\b",
            r"\bcurrency\b",
            r"\bopening\s+balance\b",
            r"\bclosing\s+balance\b",
            r"\bbrought\s+forward\b",
            r"\bcarried\s+forward\b",
            r"\bpage\s+\d+\b",
            r"\baddress\b",
            r"\bphone\b",
            r"\bemail\b",
        ]
        return any(re.search(pattern, joined) for pattern in metadata_patterns)

    def _table_header_anchor_score(self, row: List[Any]) -> float:
        if not row:
            return 0.0

        non_empty = [
            str(cell).strip()
            for cell in row
            if cell not in (None, "") and str(cell).strip()
        ]
        if not non_empty:
            return 0.0

        date_keywords = ["date", "value date", "posting date", "trans date", "dt"]
        reference_keywords = ["reference", "ref", "cheque", "chq", "document", "trx id"]
        narration_keywords = [
            "description",
            "narration",
            "details",
            "memo",
            "particular",
            "remarks",
        ]
        debit_keywords = ["debit", "dr", "withdrawal", "paid out"]
        credit_keywords = ["credit", "cr", "deposit", "paid in"]
        balance_keywords = ["balance", "running balance", "available balance"]

        group_hits = {
            "date": False,
            "reference": False,
            "narration": False,
            "debit": False,
            "credit": False,
            "balance": False,
        }
        amount_like_cells = 0
        long_cells = 0

        for text in non_empty:
            if self._contains_any_keyword(text, date_keywords):
                group_hits["date"] = True
            if self._contains_any_keyword(text, reference_keywords):
                group_hits["reference"] = True
            if self._contains_any_keyword(text, narration_keywords):
                group_hits["narration"] = True
            if self._contains_any_keyword(text, debit_keywords):
                group_hits["debit"] = True
            if self._contains_any_keyword(text, credit_keywords):
                group_hits["credit"] = True
            if self._contains_any_keyword(text, balance_keywords):
                group_hits["balance"] = True
            if self._value_looks_like_amount(text):
                amount_like_cells += 1
            if len(text) > 28:
                long_cells += 1

        score = float(sum(1 for hit in group_hits.values() if hit) * 4)
        if (group_hits["debit"] or group_hits["credit"] or group_hits["balance"]) and (
            group_hits["date"] or group_hits["reference"] or group_hits["narration"]
        ):
            score += 5.0
        if len(non_empty) >= 3:
            score += 1.0
        if amount_like_cells >= 2:
            score -= 3.0
        if long_cells:
            score -= min(3.0, float(long_cells))
        if self._looks_like_statement_metadata_row(row):
            score -= 5.0
        return score

    def _looks_like_header(self, row: List[Any]) -> bool:
        if self._looks_like_data_row(row):
            return False
        anchor_score = self._table_header_anchor_score(row)
        if anchor_score >= 8:
            return True
        return self._header_score(row) >= 6

    def _normalize_headers(self, headers: List[Any]) -> List[str]:
        normalized = []
        seen: Dict[str, int] = {}
        for idx, h in enumerate(headers):
            if h is None or str(h).strip() == "":
                base = f"Col_{idx + 1}"
            else:
                base = self._canonicalize_header_name(str(h).strip(), idx)

            key = base.lower()
            count = seen.get(key, 0)
            seen[key] = count + 1
            normalized.append(base if count == 0 else f"{base}_{count + 1}")
        return normalized

    def _default_headers(self, count: int) -> List[str]:
        return [f"Col_{i + 1}" for i in range(count)]

    def _split_rows_with_headers(
        self,
        rows: List[List[Any]],
    ) -> tuple[List[str], List[List[Any]]]:
        if not rows:
            return [], []

        width = max((len(row) for row in rows), default=0)
        normalized_rows = [self._normalize_row(list(row), width) for row in rows]

        header_index: Optional[int] = None
        best_anchor_score = float("-inf")
        search_limit = min(len(normalized_rows), 50)

        for idx in range(search_limit):
            row = normalized_rows[idx]
            score = self._table_header_anchor_score(row)
            if self._looks_like_data_row(row):
                score -= 4
            if idx + 1 < len(normalized_rows) and self._looks_like_data_row(normalized_rows[idx + 1]):
                score += 2
            if idx + 2 < len(normalized_rows) and self._looks_like_data_row(normalized_rows[idx + 2]):
                score += 1
            if score > best_anchor_score:
                best_anchor_score = score
                header_index = idx

        if header_index is not None and best_anchor_score >= 8:
            start = header_index
            end = header_index

            while start > 0:
                prev_row = normalized_rows[start - 1]
                prev_anchor = self._table_header_anchor_score(prev_row)
                if prev_anchor >= 5 and not self._looks_like_data_row(prev_row):
                    start -= 1
                    continue
                break

            while end + 1 < search_limit:
                next_row = normalized_rows[end + 1]
                next_anchor = self._table_header_anchor_score(next_row)
                if next_anchor >= 5 and not self._looks_like_data_row(next_row):
                    end += 1
                    continue
                break

            merged_header = self._merge_header_rows(normalized_rows[start : end + 1], width)
            column_headers = self._normalize_headers(merged_header)
            return column_headers, normalized_rows[end + 1 :]

        # Fallback: keep prior generic header detection for less structured files.
        fallback_index: Optional[int] = None
        fallback_score = 0
        fallback_search_limit = min(len(normalized_rows), 12)
        for idx in range(fallback_search_limit):
            row = normalized_rows[idx]
            score = self._header_score(row)
            if self._looks_like_data_row(row):
                score -= 4
            if idx + 1 < len(normalized_rows) and self._looks_like_data_row(normalized_rows[idx + 1]):
                score += 2
            if score > fallback_score:
                fallback_score = score
                fallback_index = idx

        if fallback_index is not None and fallback_score >= 5:
            merged_header = self._merge_header_rows([normalized_rows[fallback_index]], width)
            column_headers = self._normalize_headers(merged_header)
            return column_headers, normalized_rows[fallback_index + 1 :]

        return self._default_headers(width), normalized_rows

    def _merge_header_rows(self, header_rows: List[List[Any]], width: int) -> List[str]:
        merged: List[str] = []
        for column_idx in range(width):
            parts: List[str] = []
            for row in header_rows:
                if column_idx >= len(row):
                    continue
                text = str(row[column_idx]).strip() if row[column_idx] is not None else ""
                if not text:
                    continue
                if re.match(r"^-+$", text):
                    continue
                if not parts or parts[-1].lower() != text.lower():
                    parts.append(text)
            merged.append(" ".join(parts).strip())
        return merged

    def _canonicalize_header_name(self, header: str, idx: int) -> str:
        text = re.sub(r"\s+", " ", header).strip()
        if not text:
            return f"Col_{idx + 1}"

        lowered = text.lower()
        alias_map = [
            (["transaction date", "trans date", "value date", "posting date", "date", "dt"], "Date"),
            (
                [
                    "transaction description",
                    "description",
                    "narration",
                    "narrative",
                    "details",
                    "memo",
                    "remark",
                    "remarks",
                    "particular",
                    "particulars",
                ],
                "Description",
            ),
            (["reference", "ref", "cheque", "check", "chq", "document"], "Reference"),
            (["debit", "dr"], "Debit"),
            (["credit", "cr"], "Credit"),
            (["balance", "running balance", "available balance"], "Balance"),
        ]

        for candidates, normalized in alias_map:
            if any(candidate == lowered or candidate in lowered for candidate in candidates):
                return normalized

        if re.match(r"^col[_ ]?\d+$", lowered):
            return f"Col_{idx + 1}"

        return text

    def _header_score(self, row: List[Any]) -> int:
        if not row:
            return 0

        score = 0
        non_empty = [cell for cell in row if cell not in (None, "")]
        if not non_empty:
            return 0

        header_keywords = [
            "date",
            "dt",
            "description",
            "desc",
            "narr",
            "details",
            "memo",
            "particular",
            "reference",
            "ref",
            "debit",
            "credit",
            "balance",
            "dr",
            "cr",
        ]

        for cell in non_empty:
            text = str(cell).strip().lower()
            if not text:
                continue

            normalized = re.sub(r"[^a-z0-9]+", " ", text)
            tokens = {token for token in normalized.split() if token}

            for keyword in header_keywords:
                if (len(keyword) <= 2 and keyword in tokens) or keyword in text:
                    score += 3
                    break

            if re.match(r"^col[_ ]?\d+$", text):
                score -= 2
            elif self._value_looks_like_amount(text):
                score -= 2
            elif self._value_looks_like_date(text):
                score -= 1
            elif re.search(r"[a-z]", text):
                score += 1

        if len(non_empty) >= 3:
            score += 1

        return score

    def _looks_like_data_row(self, row: List[Any]) -> bool:
        non_empty = [cell for cell in row if cell not in (None, "")]
        if not non_empty:
            return False

        date_hits = sum(1 for cell in non_empty if self._value_looks_like_date(cell))
        amount_hits = sum(1 for cell in non_empty if self._value_looks_like_amount(cell))
        ref_hits = sum(1 for cell in non_empty if self._value_looks_like_reference(cell))
        narration_hits = sum(1 for cell in non_empty if self._value_looks_like_narration(cell))

        if self._looks_like_statement_metadata_row(row) and ref_hits == 0 and amount_hits <= 1:
            return False

        return (
            (date_hits >= 1 and amount_hits >= 1)
            or amount_hits >= 2
            or (date_hits >= 1 and ref_hits >= 1)
            or (date_hits >= 1 and narration_hits >= 1)
        )

    def _value_looks_like_date(self, value: Any) -> bool:
        if value in (None, ""):
            return False
        text = str(value).strip()
        if not text:
            return False
        normalized = (
            text.replace("\xa0", " ")
            .replace("\u00ad", "-")
            .replace("–", "-")
            .replace("—", "-")
            .strip()
        )
        if re.match(r"^\d{4}[/-]\d{1,2}[/-]\d{1,2}$", text):
            return True
        if re.match(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$", text):
            return True
        if re.match(r"^\d{1,2}[-/][A-Za-z]{3,9}[-/]\d{2,4}$", normalized):
            return True
        if re.match(r"^\d{1,2}[A-Za-z]{3,9}\d{2,4}$", normalized):
            return True

        date_formats = [
            "%d-%b-%Y",
            "%d/%b/%Y",
            "%d-%B-%Y",
            "%d/%B/%Y",
            "%d%b%Y",
            "%d%B%Y",
            "%d-%b-%y",
            "%d/%b/%y",
            "%d%b%y",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%d/%m/%y",
            "%d-%m-%y",
        ]
        for fmt in date_formats:
            try:
                datetime.strptime(normalized, fmt)
                return True
            except ValueError:
                continue

        try:
            datetime.fromisoformat(text)
            return True
        except ValueError:
            return False

    def _value_looks_like_amount(self, value: Any) -> bool:
        if value in (None, ""):
            return False
        text = str(value).strip()
        if not text:
            return False
        cleaned = text.replace(",", "").replace("$", "").replace("€", "").replace("£", "")
        cleaned = re.sub(r"^(?:[A-Z]{2,4}\s+)", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"^(?:CR|DR|CREDIT|DEBIT)\s+", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+(?:CR|DR|CREDIT|DEBIT)$", "", cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.replace(" ", "")
        if cleaned.startswith("(") and cleaned.endswith(")"):
            cleaned = f"-{cleaned[1:-1]}"
        return bool(re.match(r"^-?\d+(\.\d{1,2})?$", cleaned))

    def _value_looks_like_reference(self, value: Any) -> bool:
        if value in (None, ""):
            return False
        text = re.sub(r"[^A-Za-z0-9]", "", str(value).strip())
        if len(text) < 4:
            return False
        return bool(re.search(r"[A-Za-z]", text) and re.search(r"\d", text))

    def _value_looks_like_narration(self, value: Any) -> bool:
        if value in (None, ""):
            return False
        text = str(value).strip()
        if len(text) < 6:
            return False
        letters = len(re.findall(r"[A-Za-z]", text))
        digits = len(re.findall(r"\d", text))
        spaces = len(re.findall(r"\s", text))
        return letters >= 4 and letters > digits and spaces >= 1

    def _normalize_row(self, row: List[Any], width: int) -> List[Any]:
        # Pad or trim to match headers
        if len(row) < width:
            return row + [None] * (width - len(row))
        return row[:width]

    def _ensure_min_columns(
        self,
        raw_data: List[List[Any]],
        column_headers: List[str],
        min_cols: int = 4,
    ) -> tuple[List[List[Any]], List[str]]:
        if len(column_headers) >= min_cols:
            return raw_data, column_headers
        extra = min_cols - len(column_headers)
        start_idx = len(column_headers)
        column_headers = column_headers + [
            f"Col_{start_idx + i + 1}" for i in range(extra)
        ]
        padded_rows = [self._normalize_row(row, len(column_headers)) for row in raw_data]
        return padded_rows, column_headers

    def _refine_headers_from_samples(
        self,
        raw_data: List[List[Any]],
        column_headers: List[str],
    ) -> List[str]:
        if not raw_data or not column_headers:
            return column_headers

        refined = list(column_headers)

        def _first_explicit_index(keywords: List[str]) -> Optional[int]:
            return self._find_explicit_header_index(refined, keywords)

        def _best_idx(rule, exclude: Optional[set[int]] = None) -> Optional[int]:
            exclude = exclude or set()
            best_idx = None
            best_score = -1.0
            for idx in range(len(refined)):
                if idx in exclude:
                    continue
                score = self._column_fit_score(raw_data, idx, rule, sample_size=None)
                if score > best_score:
                    best_idx = idx
                    best_score = score
            return best_idx

        def _score(idx: Optional[int], rule) -> float:
            if idx is None:
                return 0.0
            return self._column_fit_score(raw_data, idx, rule, sample_size=None)

        used_indices: set[int] = set()

        date_idx = _first_explicit_index(
            ["date", "dt", "value date", "posting date", "transaction date"]
        )
        if date_idx is None:
            date_idx = _best_idx(self._value_looks_like_date)
        if date_idx is not None and _score(date_idx, self._value_looks_like_date) >= 0.75:
            refined[date_idx] = "Date"
            used_indices.add(date_idx)

        reference_idx = _first_explicit_index(
            ["reference", "ref", "cheque", "check", "chq", "document"]
        )
        if reference_idx is None:
            reference_idx = _best_idx(self._value_looks_like_reference, exclude=used_indices)
        if reference_idx is not None and _score(reference_idx, self._value_looks_like_reference) >= 0.45:
            refined[reference_idx] = "Reference"
            used_indices.add(reference_idx)

        narration_idx = _first_explicit_index(
            [
                "description",
                "narration",
                "narrative",
                "details",
                "memo",
                "remark",
                "remarks",
                "particular",
                "particulars",
            ]
        )
        if narration_idx is None:
            narration_idx = _best_idx(self._value_looks_like_narration, exclude=used_indices)
        if narration_idx is not None and _score(narration_idx, self._value_looks_like_narration) >= 0.45:
            refined[narration_idx] = "Description"
            used_indices.add(narration_idx)

        debit_header, credit_header = self._infer_debit_credit_headers(
            refined,
            raw_data,
            sample_size=None,
            non_empty_threshold=0.02,
        )
        amount_roles = [("Debit", debit_header), ("Credit", credit_header)]

        for normalized_name, header in amount_roles:
            if not header:
                continue
            try:
                idx = refined.index(header)
            except ValueError:
                continue

            amount_score = self._column_fit_score(
                raw_data,
                idx,
                self._value_looks_like_amount,
                sample_size=None,
            )
            non_empty_ratio = self._column_non_empty_ratio(
                raw_data,
                idx,
                sample_size=None,
            )
            if amount_score >= 0.6 and non_empty_ratio >= 0.02:
                refined[idx] = normalized_name
                used_indices.add(idx)

        balance_idx = None
        for idx, header in enumerate(refined):
            normalized = header.lower().strip()
            if "balance" in normalized:
                balance_idx = idx
                break

        if balance_idx is None:
            remaining_amount_candidates: List[tuple[int, float, float]] = []
            for idx in range(len(refined)):
                if idx in used_indices:
                    continue
                amount_score = self._column_fit_score(
                    raw_data,
                    idx,
                    self._value_looks_like_amount,
                    sample_size=None,
                )
                non_empty_ratio = self._column_non_empty_ratio(
                    raw_data,
                    idx,
                    sample_size=None,
                )
                if amount_score >= 0.7 and non_empty_ratio >= 0.6:
                    remaining_amount_candidates.append((idx, amount_score, non_empty_ratio))

            if remaining_amount_candidates:
                balance_idx = max(
                    remaining_amount_candidates,
                    key=lambda item: (item[2], item[1]),
                )[0]

        if balance_idx is not None:
            refined[balance_idx] = "Balance"

        return self._normalize_headers(refined)

    def _azure_configured(self) -> bool:
        DocumentIntelligenceClient, AzureKeyCredential = _load_azure_document_client()
        if DocumentIntelligenceClient is None or AzureKeyCredential is None:
            return False
        if not settings.AZURE_AI_KEY or not settings.AZURE_AI_ENDPOINT:
            return False
        if "test-key" in settings.AZURE_AI_KEY:
            return False
        if "test.api.cognitive.microsoft.com" in settings.AZURE_AI_ENDPOINT:
            return False
        return True

    def _ocr_available(self) -> bool:
        return _load_pdf2image_convert() is not None and _load_pytesseract() is not None

    def _table_to_matrix(self, table: Any) -> List[List[str]]:
        row_count = table.row_count or 0
        col_count = table.column_count or 0
        if row_count == 0 or col_count == 0:
            return []

        grid: List[List[str]] = [["" for _ in range(col_count)] for _ in range(row_count)]

        for cell in table.cells:
            content = (cell.content or "").strip()
            row_idx = cell.row_index or 0
            col_idx = cell.column_index or 0
            row_span = cell.row_span or 1
            col_span = cell.column_span or 1

            for r in range(row_idx, min(row_idx + row_span, row_count)):
                for c in range(col_idx, min(col_idx + col_span, col_count)):
                    if grid[r][c]:
                        grid[r][c] = f"{grid[r][c]} {content}".strip()
                    else:
                        grid[r][c] = content

        return grid

    def _merge_table_cells(self, tables: List[Any]) -> List[List[str]]:
        # Prefer larger tables; attempt to merge tables with same column count
        tables_sorted = sorted(
            tables,
            key=lambda t: ((t.row_count or 0) * (t.column_count or 0)),
            reverse=True,
        )
        primary = tables_sorted[0]
        target_cols = primary.column_count or 0

        def _table_page(table: Any) -> int:
            regions = getattr(table, "bounding_regions", None) or []
            if not regions:
                return 0
            return min((r.page_number or 0) for r in regions)

        merge_candidates = [
            t for t in tables if (t.column_count or 0) == target_cols and (t.row_count or 0) > 0
        ]
        merge_candidates.sort(key=_table_page)

        combined_rows: List[List[str]] = []
        for idx, table in enumerate(merge_candidates):
            matrix = self._table_to_matrix(table)
            if not matrix:
                continue
            if idx == 0:
                combined_rows.extend(matrix)
                continue
            # If header repeats, skip it
            if combined_rows and matrix and self._looks_like_header(matrix[0]):
                if self._normalize_headers(matrix[0]) == self._normalize_headers(combined_rows[0]):
                    combined_rows.extend(matrix[1:])
                else:
                    combined_rows.extend(matrix)
            else:
                combined_rows.extend(matrix)

        # Fallback to primary table if merge failed
        if not combined_rows:
            combined_rows = self._table_to_matrix(primary)

        combined_rows = [
            [str(cell).strip() if cell is not None else "" for cell in row]
            for row in combined_rows
        ]
        return [row for row in combined_rows if any(cell for cell in row)]

    def _merge_local_tables(self, tables: List[List[List[Any]]]) -> List[List[str]]:
        def _table_score(table: List[List[Any]]) -> int:
            if not table:
                return 0
            col_count = max((len(r) for r in table), default=0)
            row_count = len(table)
            return row_count * col_count

        def _table_width(table: List[List[Any]]) -> int:
            return max((len(r) for r in table), default=0)

        tables_sorted = sorted(tables, key=_table_score, reverse=True)
        primary = tables_sorted[0]
        target_cols = max((_table_width(t) for t in tables), default=0)

        def _normalize_table(table: List[List[Any]], width: int) -> List[List[str]]:
            rows = []
            for row in table:
                normalized = [str(cell).strip() if cell is not None else "" for cell in row]
                if len(normalized) < width:
                    normalized += [""] * (width - len(normalized))
                else:
                    normalized = normalized[:width]
                rows.append(normalized)
            return [r for r in rows if any(cell for cell in r)]

        combined_rows: List[List[str]] = []
        for idx, table in enumerate(tables_sorted):
            matrix = _normalize_table(table, target_cols)
            if not matrix:
                continue
            if idx == 0:
                combined_rows.extend(matrix)
                continue
            if combined_rows and matrix and self._looks_like_header(matrix[0]):
                if self._normalize_headers(matrix[0]) == self._normalize_headers(combined_rows[0]):
                    combined_rows.extend(matrix[1:])
                else:
                    combined_rows.extend(matrix)
            else:
                combined_rows.extend(matrix)

        if not combined_rows:
            combined_rows = _normalize_table(primary, target_cols)

        return combined_rows

    def _should_merge_text_rows(self, table_rows: List[List[str]]) -> bool:
        if not table_rows:
            return True

        transaction_like_rows = [row for row in table_rows if self._looks_like_data_row(row)]
        if len(transaction_like_rows) < 8:
            return True

        header_candidates = [
            row for row in table_rows[:25] if self._table_header_anchor_score(row) >= 8
        ]
        if not header_candidates:
            return True

        width = max((len(row) for row in table_rows), default=0)
        amount_columns = 0
        for col_idx in range(width):
            amount_score = self._column_fit_score(
                table_rows,
                col_idx,
                self._value_looks_like_amount,
                sample_size=40,
            )
            non_empty_ratio = self._column_non_empty_ratio(
                table_rows,
                col_idx,
                sample_size=40,
            )
            if amount_score >= 0.55 and non_empty_ratio >= 0.04:
                amount_columns += 1

        return amount_columns < 2

    def _merge_table_and_text_rows(
        self,
        table_rows: List[List[str]],
        text_rows: List[List[str]],
    ) -> List[List[str]]:
        if not table_rows:
            return text_rows

        target_cols = max(
            max((len(r) for r in table_rows), default=0),
            max((len(r) for r in text_rows), default=0),
        )
        if target_cols == 0:
            return table_rows

        def _normalize(row: List[Any]) -> List[str]:
            normalized = [str(cell).strip() if cell is not None else "" for cell in row]
            if len(normalized) < target_cols:
                normalized += [""] * (target_cols - len(normalized))
            else:
                normalized = normalized[:target_cols]
            return normalized

        merged_rows = [_normalize(row) for row in table_rows if any(row)]
        seen = {("|".join(row)).lower() for row in merged_rows}
        transaction_seen = {
            self._row_transaction_signature(row): row
            for row in merged_rows
            if self._looks_like_data_row(row)
        }

        for row in text_rows:
            normalized = _normalize(row)
            if not any(normalized):
                continue
            if self._looks_like_header(normalized):
                continue
            if self._looks_like_statement_metadata_row(normalized):
                continue
            if not self._looks_like_data_row(normalized):
                continue
            signature = ("|".join(normalized)).lower()
            if signature in seen:
                continue
            tx_signature = self._row_transaction_signature(normalized)
            if tx_signature and tx_signature in transaction_seen:
                continue
            seen.add(signature)
            if tx_signature:
                transaction_seen[tx_signature] = normalized
            merged_rows.append(normalized)

        return merged_rows

    def _split_pdf_text_line(self, line: str) -> List[str]:
        parts = [p.strip() for p in re.split(r"\s{2,}|\t", line) if p.strip()]
        amounts = self._extract_amounts_from_line(line)
        if not amounts:
            return parts

        for amt in amounts:
            raw = amt.get("raw", "").strip()
            if not raw:
                continue
            if any(raw in part for part in parts):
                continue
            parts.append(raw)

        return parts

    def _extract_text_lines_with_pypdf(
        self,
        file_content: bytes,
        max_pages: Optional[int] = None,
        row_limit: Optional[int] = None,
    ) -> List[str]:
        PdfReader = _load_pypdf_reader()
        if PdfReader is None:
            return []

        lines: List[str] = []
        try:
            reader = PdfReader(BytesIO(file_content))
            pages = reader.pages[:max_pages] if max_pages else reader.pages
            for page in pages:
                text = page.extract_text() or ""
                for line in text.splitlines():
                    clean = line.strip()
                    if not clean:
                        continue
                    lines.append(clean)
                    if row_limit and len(lines) >= row_limit * 8:
                        return lines
        except Exception:
            return []
        return lines

    def _normalize_pdf_line_text(self, line: str) -> str:
        text = line.replace("\xa0", " ").replace("\u00ad", "-").replace("–", "-").replace("—", "-")
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _sanitize_statement_remarks(self, remarks: str) -> str:
        cleaned = self._normalize_pdf_line_text(remarks or "")
        if not cleaned:
            return ""

        cut_patterns = [
            r"\bguaranty trust bank\b",
            r"\bcustomer statement\b",
            r"\baccount\s*no\b",
            r"\bpage\s*:?\s*\d+\s+of\s+\d+\b",
            r"\bpmb\b",
            r"\bcastle road\b",
            r"\bambassadorial area\b",
            r"\bphone\b",
        ]

        cut_index: Optional[int] = None
        for pattern in cut_patterns:
            match = re.search(pattern, cleaned, re.IGNORECASE)
            if match:
                cut_index = match.start() if cut_index is None else min(cut_index, match.start())

        if cut_index is not None:
            cleaned = cleaned[:cut_index].strip(" -:;,.")
        return cleaned

    def _parse_structured_bank_statement_lines(
        self,
        text_lines: List[str],
        row_limit: Optional[int] = None,
    ) -> List[List[str]]:
        if not text_lines:
            return []

        header_pattern = re.compile(
            r"trans\s*date.*reference.*value\s*date.*debit.*credit.*balance.*remarks",
            re.IGNORECASE,
        )
        date_pattern = (
            r"(?:"
            r"\d{1,2}[-/][A-Za-z]{3}[-/]\d{4}"
            r"|"
            r"\d{1,2}[A-Za-z]{3}\d{4}"
            r"|"
            r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}"
            r"|"
            r"\d{4}[-/]\d{1,2}[-/]\d{1,2}"
            r")"
        )
        amount_pattern = r"-?\d{1,3}(?:,\d{3})*(?:\.\d{2})"
        transaction_pattern = re.compile(
            rf"^(?P<trans_date>{date_pattern})\s+"
            rf"(?P<reference>[A-Za-z0-9/_-]{{4,}})\s+"
            rf"(?P<value_date>{date_pattern})\s+"
            rf"(?P<debit>{amount_pattern})\s+"
            rf"(?P<credit>{amount_pattern})\s+"
            rf"(?P<balance>{amount_pattern})(?:\s+(?P<remarks>.*))?$",
            re.IGNORECASE,
        )

        metadata_line_pattern = re.compile(
            r"\b(customer statement|print date|account no|period|address|currency|opening balance|closing balance|page\s+\d+)\b",
            re.IGNORECASE,
        )
        remarks_footer_pattern = re.compile(
            r"\b(guaranty trust bank|phone|branch|customer statement|page\s+\d+\s+of\s+\d+)\b",
            re.IGNORECASE,
        )

        started = False
        rows: List[List[str]] = []
        current_row: Optional[List[str]] = None

        for raw_line in text_lines:
            line = self._normalize_pdf_line_text(raw_line)
            if not line:
                continue

            if header_pattern.search(line):
                started = True
                continue

            if not started:
                continue

            if metadata_line_pattern.search(line):
                continue

            match = transaction_pattern.match(line)
            if match:
                if current_row:
                    rows.append(current_row)
                    if row_limit and len(rows) >= row_limit:
                        break

                remarks = self._sanitize_statement_remarks(match.group("remarks") or "")

                current_row = [
                    match.group("trans_date") or "",
                    match.group("reference") or "",
                    match.group("value_date") or "",
                    match.group("debit") or "",
                    match.group("credit") or "",
                    match.group("balance") or "",
                    remarks,
                ]
                continue

            if current_row:
                if line.lower().startswith("trans date"):
                    continue
                if remarks_footer_pattern.search(line):
                    continue
                current_remarks = current_row[6].strip()
                merged_remarks = (
                    f"{current_remarks} {line}".strip() if current_remarks else line
                )
                current_row[6] = self._sanitize_statement_remarks(merged_remarks)

        if current_row:
            rows.append(current_row)

        if not rows:
            return []

        deduped_rows: List[List[str]] = []
        seen: set[str] = set()
        for row in rows:
            row[6] = self._sanitize_statement_remarks(str(row[6] or ""))
            signature = "|".join(
                [
                    str(row[0]).strip().lower(),
                    str(row[1]).strip().lower(),
                    str(row[2]).strip().lower(),
                    str(row[3]).strip().lower(),
                    str(row[4]).strip().lower(),
                    str(row[5]).strip().lower(),
                ]
            )
            if signature in seen:
                continue
            seen.add(signature)
            deduped_rows.append(row)

        if len(deduped_rows) < 5:
            return []

        return [
            ["Trans Date", "Reference", "Value Date", "Debit", "Credit", "Balance", "Remarks"],
            *deduped_rows,
        ]

    def _pick_best_pdf_payload(
        self,
        primary: Dict[str, Any],
        fallback: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Prefer the payload with better debit/credit coverage when PDFs differ."""
        if not fallback or not fallback.get("raw_data"):
            return primary

        def _payload_score(payload: Dict[str, Any]) -> tuple[float, float, int, int]:
            raw_data = payload.get("raw_data") or []
            if not raw_data:
                return (0.0, 0.0, 0, 0)
            column_headers = payload.get("column_headers") or []
            width = max((len(r) for r in raw_data), default=0)
            col_count = len(column_headers) if column_headers else width
            amount_candidate_indices = []
            balance_bonus = 0.0
            canonical_header_bonus = 0.0
            generic_header_penalty = 0.0
            for idx in range(col_count):
                amount_score = self._column_fit_score(
                    raw_data,
                    idx,
                    self._value_looks_like_amount,
                    sample_size=40,
                )
                non_empty_ratio = self._column_non_empty_ratio(
                    raw_data,
                    idx,
                    sample_size=40,
                )
                if amount_score >= 0.6 and non_empty_ratio >= 0.03:
                    amount_candidate_indices.append(idx)
                header = column_headers[idx] if idx < len(column_headers) else ""
                normalized_header = str(header).lower()
                if "balance" in normalized_header:
                    balance_bonus = 0.4
                if normalized_header in {
                    "date",
                    "reference",
                    "description",
                    "debit",
                    "credit",
                    "balance",
                }:
                    canonical_header_bonus += 0.35
                if normalized_header.startswith("col_"):
                    generic_header_penalty += 0.2

            exclusivity_score = 0.0
            if len(amount_candidate_indices) >= 2:
                pair_scores = []
                for left_idx in range(len(amount_candidate_indices)):
                    for right_idx in range(left_idx + 1, len(amount_candidate_indices)):
                        pair_scores.append(
                            self._pair_exclusivity_score(
                                raw_data,
                                amount_candidate_indices[left_idx],
                                amount_candidate_indices[right_idx],
                                sample_size=40,
                            )
                        )
                exclusivity_score = max(pair_scores) if pair_scores else 0.0

            amount_cols = len(amount_candidate_indices)
            width_penalty = max(col_count - 5, 0) * 0.15
            shape_score = (
                amount_cols
                + balance_bonus
                + canonical_header_bonus
                - generic_header_penalty
                - width_penalty
            )
            return (shape_score, exclusivity_score, -col_count, len(raw_data))

        primary_score = _payload_score(primary)
        fallback_score = _payload_score(fallback)

        if fallback_score > primary_score:
            method = fallback.get("method", "pdf-local")
            fallback["method"] = f"{method}-preferred"
            return fallback

        return primary

    def _row_transaction_signature(self, row: List[Any]) -> str:
        if not row:
            return ""
        parts = [str(cell or "").strip().lower() for cell in row if str(cell or "").strip()]
        if not parts:
            return ""
        date_part = next((part for part in parts if self._value_looks_like_date(part)), "")
        amount_part = next((part for part in reversed(parts) if self._value_looks_like_amount(part)), "")
        reference_part = next((part for part in parts if self._value_looks_like_reference(part)), "")
        if not date_part and not amount_part:
            return ""
        return "|".join([date_part, reference_part, amount_part])

    def _extract_pdf_ocr(
        self,
        file_content: bytes,
        org_id: str,
        max_pages: Optional[int] = None,
        row_limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        convert_from_bytes = _load_pdf2image_convert()
        pytesseract = _load_pytesseract()
        if not self._ocr_available():
            raise ValueError("OCR dependencies are not installed")

        logger.info(f"Extracting PDF for org {org_id} via OCR fallback")
        rows: List[List[str]] = []

        try:
            images = convert_from_bytes(
                file_content,
                dpi=220,
                first_page=1,
                last_page=max_pages or None,
            )
        except Exception as e:
            logger.warning("OCR conversion failed: %s", str(e))
            return {"raw_data": [], "column_headers": [], "confidence": 0}

        for image in images:
            text = pytesseract.image_to_string(image, config="--psm 6")
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                if self._looks_like_header_line(line):
                    continue
                parsed = self._parse_ocr_line(line)
                if parsed:
                    rows.append(parsed)
                    if row_limit and len(rows) >= row_limit:
                        break
            if row_limit and len(rows) >= row_limit:
                break

        if not rows:
            return {"raw_data": [], "column_headers": [], "confidence": 0}

        return {
            "raw_data": rows,
            "column_headers": ["Date", "Description", "Reference", "Amount"],
            "confidence": 50,
            "method": "ocr",
        }

    def _parse_ocr_line(self, line: str) -> Optional[List[str]]:
        # Attempt to parse a bank statement-like line into 4 columns
        date_match = re.search(
            r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b",
            line,
        )
        if not date_match:
            return None

        amounts = self._extract_amounts_from_line(line)
        if not amounts:
            return None

        date_val = date_match.group(1)
        amount_val = self._select_transaction_amount(amounts, line)
        if not amount_val:
            return None

        working = line.replace(date_val, "")
        for amt in amounts:
            working = working.replace(amt["raw"], "")
        working = working.strip()

        reference, narration = self._extract_reference_and_narration(working)
        return [date_val, narration, reference, amount_val]

    def _extract_amounts_from_line(self, line: str) -> List[Dict[str, str]]:
        pattern = re.compile(
            r"(?P<amt>[-(]?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)(?:\s*(?P<label>CR|DR|CREDIT|DEBIT))?",
            re.IGNORECASE,
        )
        results = []
        for match in pattern.finditer(line):
            raw = match.group("amt")
            label = (match.group("label") or "").upper()
            pos = match.start()
            cleaned = raw.replace("$", "").strip()
            is_negative = cleaned.startswith("(") and cleaned.endswith(")")
            if is_negative:
                cleaned = cleaned[1:-1]
            cleaned = cleaned.replace(",", "")
            if not re.match(r"^\d+(\.\d{2})?$", cleaned):
                continue

            sign = -1 if label in {"DR", "DEBIT"} else 1
            if is_negative:
                sign = -1

            results.append(
                {
                    "raw": raw,
                    "clean": cleaned,
                    "label": label,
                    "sign": sign,
                    "pos": pos,
                }
            )
        return results

    def _select_transaction_amount(self, amounts: List[Dict[str, str]], line: str) -> Optional[str]:
        line_lower = line.lower()
        if len(amounts) == 0:
            return None

        if "debit" in line_lower or re.search(r"\bdr\b", line_lower):
            candidate = self._amount_near_keyword(amounts, line, ["debit", "dr"])
            if candidate:
                candidate["sign"] = -1
                return self._format_signed_amount(candidate)

        if "credit" in line_lower or re.search(r"\bcr\b", line_lower):
            candidate = self._amount_near_keyword(amounts, line, ["credit", "cr"])
            if candidate:
                candidate["sign"] = 1
                return self._format_signed_amount(candidate)

        # If balance appears, treat last amount as balance and use previous
        if "balance" in line_lower and len(amounts) >= 2:
            candidate = amounts[-2]
            return self._format_signed_amount(candidate)

        labeled = [a for a in amounts if a["label"]]
        if labeled:
            return self._format_signed_amount(labeled[0])

        if len(amounts) >= 3:
            # Often: debit, credit, balance -> choose middle
            return self._format_signed_amount(amounts[-2])

        # Default: use last amount
        return self._format_signed_amount(amounts[-1])

    def _format_signed_amount(self, amount: Dict[str, str]) -> str:
        value = amount["clean"]
        if amount["sign"] < 0 and not value.startswith("-"):
            return f"-{value}"
        return value

    def _amount_near_keyword(
        self,
        amounts: List[Dict[str, str]],
        line: str,
        keywords: List[str],
    ) -> Optional[Dict[str, str]]:
        line_lower = line.lower()
        positions = [line_lower.find(k) for k in keywords if k in line_lower]
        if not positions:
            return None

        # Use the first keyword position
        target_pos = min(pos for pos in positions if pos >= 0)
        best = None
        best_dist = None
        for amount in amounts:
            pos = amount.get("pos", None)
            if pos is None:
                continue
            dist = abs(pos - target_pos)
            if best is None or dist < best_dist:
                best = amount
                best_dist = dist

        return best

    def _extract_reference_and_narration(self, text: str) -> tuple[str, str]:
        if not text:
            return "", ""

        tokens = [t for t in re.split(r"\s{2,}|\t|\s{1,}", text) if t.strip()]

        reference = ""
        for token in reversed(tokens):
            norm = token.replace("-", "").replace("/", "").upper()
            if re.match(r"^[A-Z]*\d+[A-Z0-9]*$", norm) and len(norm) >= 5:
                reference = token.strip()
                break
            if re.match(r"^\d{5,}$", norm):
                reference = token.strip()
                break

        narration = text
        if reference:
            narration = text.replace(reference, "").strip()
        return reference, narration or text

    def _looks_like_header_line(self, line: str) -> bool:
        header_keywords = [
            "date",
            "description",
            "narration",
            "details",
            "reference",
            "ref",
            "amount",
            "debit",
            "credit",
            "balance",
        ]
        lowered = line.lower()
        return any(keyword in lowered for keyword in header_keywords)

    def _pdf_table_settings(self) -> List[Dict[str, Any]]:
        # Try multiple strategies to handle tricky layouts
        return [
            {
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
                "intersection_tolerance": 5,
                "snap_tolerance": 3,
                "join_tolerance": 3,
                "edge_min_length": 3,
            },
            {
                "vertical_strategy": "lines",
                "horizontal_strategy": "text",
                "intersection_tolerance": 5,
                "snap_tolerance": 3,
                "join_tolerance": 3,
                "edge_min_length": 3,
                "min_words_horizontal": 1,
            },
            {
                "vertical_strategy": "text",
                "horizontal_strategy": "text",
                "intersection_tolerance": 5,
                "snap_tolerance": 2,
                "join_tolerance": 2,
                "min_words_vertical": 1,
                "min_words_horizontal": 1,
            },
        ]

    def _estimated_table_rows(self, tables: List[List[List[Any]]]) -> int:
        return sum(len(table) for table in tables)

    def _limit_rows(
        self,
        rows: List[List[Any]],
        row_limit: Optional[int],
    ) -> List[List[Any]]:
        if row_limit is None or row_limit <= 0:
            return rows
        return rows[:row_limit]

    def _rows_to_payload(self, rows: List[List[Any]], confidence: int) -> Dict[str, Any]:
        if not rows:
            return {"raw_data": [], "column_headers": [], "confidence": 0}

        column_headers, data_rows = self._split_rows_with_headers(rows)
        raw_data = [self._normalize_row(row, len(column_headers)) for row in data_rows]
        raw_data, column_headers = self._ensure_min_columns(raw_data, column_headers)
        column_headers = self._refine_headers_from_samples(raw_data, column_headers)
        raw_data, column_headers = self._post_process_pdf_rows(raw_data, column_headers)

        return {
            "raw_data": raw_data,
            "column_headers": column_headers,
            "confidence": confidence,
        }

    def _post_process_pdf_rows(
        self,
        raw_data: List[List[Any]],
        column_headers: List[str],
    ) -> tuple[List[List[Any]], List[str]]:
        if not raw_data or not column_headers:
            return raw_data, column_headers

        working_headers = list(column_headers)
        working_rows = [
            self._normalize_row(list(row), len(working_headers))
            for row in raw_data
        ]

        working_rows, working_headers = self._merge_sparse_text_continuations(
            working_rows,
            working_headers,
        )
        working_rows, working_headers = self._merge_duplicate_amount_columns(
            working_rows,
            working_headers,
        )
        working_rows, working_headers = self._drop_empty_columns(
            working_rows,
            working_headers,
        )

        return working_rows, self._normalize_headers(working_headers)

    def _merge_sparse_text_continuations(
        self,
        raw_data: List[List[Any]],
        column_headers: List[str],
    ) -> tuple[List[List[Any]], List[str]]:
        if len(column_headers) < 2:
            return raw_data, column_headers

        rows = [list(row) for row in raw_data]
        headers = list(column_headers)
        drop_indices: set[int] = set()

        for idx in range(1, len(headers)):
            header = str(headers[idx]).strip()
            left_header = str(headers[idx - 1]).strip().lower()
            non_empty_ratio = self._column_non_empty_ratio(rows, idx, sample_size=None)
            amount_score = self._column_fit_score(
                rows, idx, self._value_looks_like_amount, sample_size=None
            )
            date_score = self._column_fit_score(
                rows, idx, self._value_looks_like_date, sample_size=None
            )
            reference_score = self._column_fit_score(
                rows, idx, self._value_looks_like_reference, sample_size=None
            )
            looks_like_sparse_text = (
                (header.lower().startswith("col_") or re.match(r"^[a-z]{1,3}$", header.lower()))
                and 0 < non_empty_ratio <= 0.4
                and amount_score < 0.2
                and date_score < 0.2
                and reference_score < 0.2
                and left_header in {"description", "narration", "details", "memo", "remarks", "remark"}
            )

            if not looks_like_sparse_text:
                continue

            merged_count = 0
            for row in rows:
                if idx >= len(row):
                    continue
                fragment = str(row[idx] or "").strip()
                if not fragment:
                    continue
                previous = str(row[idx - 1] or "").strip()
                if previous:
                    separator = (
                        ""
                        if re.match(r"^[A-Za-z]+$", fragment)
                        and re.match(r".*[A-Za-z]$", previous)
                        else " "
                    )
                    row[idx - 1] = f"{previous}{separator}{fragment}".strip()
                else:
                    row[idx - 1] = fragment
                row[idx] = ""
                merged_count += 1

            if merged_count > 0:
                drop_indices.add(idx)

        if not drop_indices:
            return rows, headers

        kept_headers = [
            header for idx, header in enumerate(headers) if idx not in drop_indices
        ]
        kept_rows = [
            [cell for idx, cell in enumerate(row) if idx not in drop_indices]
            for row in rows
        ]
        return kept_rows, kept_headers

    def _merge_duplicate_amount_columns(
        self,
        raw_data: List[List[Any]],
        column_headers: List[str],
    ) -> tuple[List[List[Any]], List[str]]:
        if len(column_headers) < 3:
            return raw_data, column_headers

        rows = [list(row) for row in raw_data]
        headers = list(column_headers)

        explicit_debit_idx = next(
            (
                idx
                for idx, header in enumerate(headers)
                if re.search(r"\b(debit|dr)\b", str(header).lower())
            ),
            None,
        )
        explicit_credit_idx = next(
            (
                idx
                for idx, header in enumerate(headers)
                if re.search(r"\b(credit|cr)\b", str(header).lower())
            ),
            None,
        )

        if explicit_debit_idx is None and explicit_credit_idx is None:
            return rows, headers

        amount_candidates: List[int] = []
        for idx, header in enumerate(headers):
            header_text = str(header).lower().strip()
            if "balance" in header_text:
                continue
            amount_score = self._column_fit_score(
                rows, idx, self._value_looks_like_amount, sample_size=None
            )
            non_empty_ratio = self._column_non_empty_ratio(rows, idx, sample_size=None)
            if amount_score >= 0.9 and non_empty_ratio >= 0.02:
                amount_candidates.append(idx)

        extra_indices = [
            idx
            for idx in amount_candidates
            if idx not in {explicit_debit_idx, explicit_credit_idx}
        ]
        if not extra_indices:
            return rows, headers

        drop_indices: set[int] = set()

        def _non_empty_count(column_idx: Optional[int]) -> int:
            if column_idx is None:
                return 0
            return sum(
                1
                for row in rows
                if column_idx < len(row) and str(row[column_idx] or "").strip()
            )

        def _overlap_count(left_idx: int, right_idx: Optional[int]) -> int:
            if right_idx is None:
                return 0
            return sum(
                1
                for row in rows
                if left_idx < len(row)
                and right_idx < len(row)
                and str(row[left_idx] or "").strip()
                and str(row[right_idx] or "").strip()
            )

        for idx in extra_indices:
            debit_score = (_overlap_count(idx, explicit_debit_idx) * 1000) + _non_empty_count(
                explicit_debit_idx
            )
            credit_score = (
                _overlap_count(idx, explicit_credit_idx) * 1000
            ) + _non_empty_count(explicit_credit_idx)

            if explicit_debit_idx is None:
                target_idx = explicit_credit_idx
            elif explicit_credit_idx is None:
                target_idx = explicit_debit_idx
            else:
                target_idx = explicit_debit_idx if debit_score < credit_score else explicit_credit_idx

            if target_idx is None:
                continue

            moved_count = 0
            for row in rows:
                if idx >= len(row) or target_idx >= len(row):
                    continue
                source_value = str(row[idx] or "").strip()
                target_value = str(row[target_idx] or "").strip()
                if not source_value:
                    continue
                if not target_value:
                    row[target_idx] = source_value
                    row[idx] = ""
                    moved_count += 1

            if moved_count > 0:
                drop_indices.add(idx)

        if not drop_indices:
            return rows, headers

        kept_headers = [
            header for idx, header in enumerate(headers) if idx not in drop_indices
        ]
        kept_rows = [
            [cell for idx, cell in enumerate(row) if idx not in drop_indices]
            for row in rows
        ]
        return kept_rows, kept_headers

    def _drop_empty_columns(
        self,
        raw_data: List[List[Any]],
        column_headers: List[str],
    ) -> tuple[List[List[Any]], List[str]]:
        keep_indices: List[int] = []
        for idx, header in enumerate(column_headers):
            has_values = any(
                idx < len(row) and str(row[idx] or "").strip()
                for row in raw_data
            )
            header_text = str(header).lower()
            is_duplicate_alias = bool(re.search(r"_(\d+)$", header_text))
            if has_values or (
                not header_text.startswith("col_") and not is_duplicate_alias
            ):
                keep_indices.append(idx)

        kept_headers = [column_headers[idx] for idx in keep_indices]
        kept_rows = [
            [row[idx] if idx < len(row) else None for idx in keep_indices]
            for row in raw_data
        ]
        return kept_rows, kept_headers

    def build_preview_metrics(
        self,
        raw_data: List[List[Any]],
        column_headers: List[str],
    ) -> Dict[str, Any]:
        metrics: Dict[str, Dict[str, Any]] = {}

        for idx, header in enumerate(column_headers):
            non_empty_count = 0
            parsed_amount_count = 0
            parsed_amount_total = Decimal("0")

            for row in raw_data:
                if idx >= len(row):
                    continue

                value = row[idx]
                if value is None or str(value).strip() == "":
                    continue

                non_empty_count += 1
                amount = self._parse_amount_value(value)
                if amount is not None:
                    parsed_amount_count += 1
                    parsed_amount_total += amount

            metrics[header] = {
                "non_empty_count": non_empty_count,
                "parsed_amount_count": parsed_amount_count,
                "parsed_amount_total": round(float(parsed_amount_total), 2),
            }

        return {
            "total_rows": len(raw_data),
            "column_metrics": metrics,
        }

    def _parse_amount_value(self, value: Any) -> Optional[Decimal]:
        if value in (None, ""):
            return None

        text = str(value).strip()
        if not text:
            return None

        negative = False
        if text.startswith("(") and text.endswith(")"):
            negative = True
            text = text[1:-1]

        cleaned = text.replace(",", "").replace("$", "").replace("€", "").replace("£", "")
        cleaned = re.sub(r"^(?:[A-Z]{2,4}\s+)", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"^(?:CR|DR|CREDIT|DEBIT)\s+", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+(?:CR|DR|CREDIT|DEBIT)$", "", cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.replace(" ", "")
        if cleaned.startswith("-"):
            negative = True
            cleaned = cleaned[1:]

        try:
            amount = Decimal(cleaned)
        except (InvalidOperation, ValueError):
            return None

        return -amount if negative else amount

    def _decode_bytes(self, file_content: bytes) -> str:
        try:
            return file_content.decode("utf-8-sig")
        except UnicodeDecodeError:
            return file_content.decode("latin-1", errors="replace")
