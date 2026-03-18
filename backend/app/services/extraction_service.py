import json
import hashlib
from typing import Dict, List, Any, Optional
import logging
from app.schemas import ColumnMapping
from datetime import datetime, date
from io import BytesIO, StringIO
import csv
import re

try:
    import openpyxl
except Exception:  # pragma: no cover - optional dependency at runtime
    openpyxl = None

try:
    import pdfplumber
except Exception:  # pragma: no cover - optional dependency at runtime
    pdfplumber = None

try:
    from pdf2image import convert_from_bytes
except Exception:  # pragma: no cover - optional dependency at runtime
    convert_from_bytes = None

try:
    import pytesseract
except Exception:  # pragma: no cover - optional dependency at runtime
    pytesseract = None

try:
    from azure.ai.documentintelligence import DocumentIntelligenceClient
    from azure.core.credentials import AzureKeyCredential
except Exception:  # pragma: no cover - optional dependency at runtime
    DocumentIntelligenceClient = None
    AzureKeyCredential = None

from app.config import settings

logger = logging.getLogger(__name__)


class ExtractionService:
    """Handles PDF/Excel extraction and AI column mapping guessing."""

    def extract(self, file_content: bytes, file_type: str, org_id: str) -> Dict[str, Any]:
        """
        Extract data from file.
        PDFs use Azure AI Document Intelligence when configured.
        """

        if file_type == "pdf":
            return self._extract_pdf(file_content, org_id)
        elif file_type == "xlsx":
            return self._extract_xlsx(file_content, org_id)
        elif file_type == "csv":
            return self._extract_csv(file_content, org_id)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    def _extract_pdf(self, file_content: bytes, org_id: str) -> Dict[str, Any]:
        """
        Extract tables from PDF using Azure AI Document Intelligence.

        Requires AZURE_AI_KEY and AZURE_AI_ENDPOINT.
        """
        if self._azure_configured():
            try:
                return self._extract_pdf_azure(file_content, org_id)
            except Exception as e:
                logger.warning(
                    "Azure PDF extraction failed, falling back to local parser: %s",
                    str(e),
                )

        return self._extract_pdf_local(file_content, org_id)

    def _extract_pdf_azure(self, file_content: bytes, org_id: str) -> Dict[str, Any]:
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

    def _extract_pdf_local(self, file_content: bytes, org_id: str) -> Dict[str, Any]:
        if pdfplumber is None:
            raise ValueError("pdfplumber is required for local PDF extraction")

        logger.info(f"Extracting PDF for org {org_id} via pdfplumber")

        tables: List[List[List[Any]]] = []
        text_rows: List[List[str]] = []

        with pdfplumber.open(BytesIO(file_content)) as pdf:
            for page in pdf.pages:
                page_tables: List[List[List[Any]]] = []
                for settings in self._pdf_table_settings():
                    extracted = page.extract_tables(settings)
                    if extracted:
                        page_tables.extend(extracted)

                if page_tables:
                    tables.extend(page_tables)
                    continue

                page_text = page.extract_text(x_tolerance=2, y_tolerance=2, layout=True) or ""
                for line in page_text.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    parts = [p.strip() for p in re.split(r"\s{2,}|\t", line) if p.strip()]
                    if len(parts) >= 3:
                        text_rows.append(parts)

        if tables:
            combined_rows = self._merge_local_tables(tables)
            if combined_rows:
                payload = self._rows_to_payload(combined_rows, confidence=72)
                payload["method"] = "pdfplumber-table"
                return payload

        if text_rows:
            payload = self._rows_to_payload(text_rows, confidence=60)
            payload["method"] = "pdfplumber-text"
            return payload

        if self._ocr_available():
            ocr_payload = self._extract_pdf_ocr(file_content, org_id)
            if ocr_payload["raw_data"]:
                return ocr_payload

        logger.warning("No tables or parsable text found in PDF (local/OCR)")
        return {"raw_data": [], "column_headers": [], "confidence": 0}

    def _extract_xlsx(self, file_content: bytes, org_id: str) -> Dict[str, Any]:
        """Extract tables from Excel using openpyxl."""
        if openpyxl is None:
            raise ValueError("openpyxl is required for XLSX extraction")

        logger.info(f"Extracting XLSX for org {org_id}")
        wb = openpyxl.load_workbook(BytesIO(file_content), data_only=True)
        ws = wb.active

        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return {"raw_data": [], "column_headers": [], "confidence": 0}

        first_row = list(rows[0])
        has_header = self._looks_like_header(first_row)

        if has_header:
            column_headers = self._normalize_headers(first_row)
            data_rows = rows[1:]
        else:
            column_headers = self._default_headers(len(first_row))
            data_rows = rows

        raw_data = [self._normalize_row(list(r), len(column_headers)) for r in data_rows]
        raw_data, column_headers = self._ensure_min_columns(raw_data, column_headers)

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

        first_row = rows[0]
        has_header = self._looks_like_header(first_row)

        if has_header:
            column_headers = self._normalize_headers(first_row)
            data_rows = rows[1:]
        else:
            column_headers = self._default_headers(len(first_row))
            data_rows = rows

        raw_data = [self._normalize_row(row, len(column_headers)) for row in data_rows]
        raw_data, column_headers = self._ensure_min_columns(raw_data, column_headers)

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
    ) -> ColumnMapping:
        """
        Use LLM to guess which columns are Date, Narration, Reference, Amount.

        Production implementation would:
        1. Send first 5 rows to GPT-4o-mini
        2. Parse response to identify columns
        3. Return mapping

        For MVP: Use heuristics
        """
        # TODO: Call GPT-4o-mini API for intelligent mapping

        # Simple heuristics for MVP
        headers = column_headers or []
        if headers:
            lower = [str(h).strip() for h in headers]

            date_header = self._match_header(lower, ["date", "dt"]) or headers[0]
            narration_header = self._match_header(
                lower, ["narr", "desc", "details", "memo", "particular"]
            ) or headers[1 if len(headers) > 1 else 0]
            reference_header = self._match_header(
                lower, ["ref", "reference", "cheque", "check", "chq", "invoice"]
            ) or headers[2 if len(headers) > 2 else 0]

            amount_header = self._match_header(
                lower, ["amount", "amt", "value", "transaction amount", "txn amount"]
            )
            debit_header = self._match_header(
                lower, ["debit", "dr", "withdrawal", "withdraw", "paid out", "payment", "charge"]
            )
            credit_header = self._match_header(
                lower, ["credit", "cr", "deposit", "paid in", "receipt", "received"]
            )

            if not amount_header and not (debit_header or credit_header):
                amount_header = headers[3 if len(headers) > 3 else 0]

            mapping = ColumnMapping(
                date=date_header,
                narration=narration_header,
                reference=reference_header,
                amount=amount_header,
                debit=debit_header,
                credit=credit_header,
            )
            return mapping

        if not raw_data or len(raw_data[0]) < 4:
            raise ValueError("Need at least 4 columns")

        return ColumnMapping(
            date="Date",
            narration="Description",
            reference="Reference",
            amount="Amount",
            debit=None,
            credit=None,
        )

    def _match_header(self, headers: List[str], keywords: List[str]) -> Optional[str]:
        for header in headers:
            h = header.lower()
            if any(k in h for k in keywords):
                return header
        return None

    def _looks_like_header(self, row: List[Any]) -> bool:
        if not row:
            return False
        non_empty = [cell for cell in row if cell not in (None, "")]
        if not non_empty:
            return False

        header_keywords = [
            "date",
            "dt",
            "desc",
            "description",
            "narr",
            "narration",
            "details",
            "memo",
            "particular",
            "reference",
            "ref",
            "check",
            "cheque",
            "chq",
            "amount",
            "amt",
            "debit",
            "credit",
            "balance",
        ]

        normalized = [str(cell).strip().lower() for cell in non_empty]
        for cell in normalized:
            if any(keyword in cell for keyword in header_keywords):
                return True
        # Fallback heuristic: mostly strings implies header
        stringish = 0
        for cell in non_empty:
            if isinstance(cell, str):
                stringish += 1
            elif isinstance(cell, (datetime, date)):
                continue
            else:
                continue
        return stringish >= max(2, len(non_empty) // 2)

    def _normalize_headers(self, headers: List[Any]) -> List[str]:
        normalized = []
        for idx, h in enumerate(headers):
            if h is None or str(h).strip() == "":
                normalized.append(f"Col_{idx + 1}")
            else:
                normalized.append(str(h).strip())
        return normalized

    def _default_headers(self, count: int) -> List[str]:
        return [f"Col_{i + 1}" for i in range(count)]

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

    def _azure_configured(self) -> bool:
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
        return convert_from_bytes is not None and pytesseract is not None

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

        tables_sorted = sorted(tables, key=_table_score, reverse=True)
        primary = tables_sorted[0]
        target_cols = max((len(r) for r in primary), default=0)

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

        merge_candidates = [t for t in tables if max((len(r) for r in t), default=0) == target_cols]

        combined_rows: List[List[str]] = []
        for idx, table in enumerate(merge_candidates):
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

    def _extract_pdf_ocr(self, file_content: bytes, org_id: str) -> Dict[str, Any]:
        if not self._ocr_available():
            raise ValueError("OCR dependencies are not installed")

        logger.info(f"Extracting PDF for org {org_id} via OCR fallback")
        rows: List[List[str]] = []

        try:
            images = convert_from_bytes(file_content, dpi=220)
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

    def _rows_to_payload(self, rows: List[List[Any]], confidence: int) -> Dict[str, Any]:
        if not rows:
            return {"raw_data": [], "column_headers": [], "confidence": 0}

        first_row = rows[0]
        has_header = self._looks_like_header(first_row)

        if has_header:
            column_headers = self._normalize_headers(first_row)
            data_rows = rows[1:]
        else:
            column_headers = self._default_headers(len(first_row))
            data_rows = rows

        raw_data = [self._normalize_row(row, len(column_headers)) for row in data_rows]
        raw_data, column_headers = self._ensure_min_columns(raw_data, column_headers)

        return {
            "raw_data": raw_data,
            "column_headers": column_headers,
            "confidence": confidence,
        }

    def _decode_bytes(self, file_content: bytes) -> str:
        try:
            return file_content.decode("utf-8-sig")
        except UnicodeDecodeError:
            return file_content.decode("latin-1", errors="replace")
