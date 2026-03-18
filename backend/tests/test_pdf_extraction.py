import os
from pathlib import Path

import pytest

try:
    import pdfplumber  # noqa: F401
except Exception:
    pdfplumber = None

from app.services.extraction_service import ExtractionService
from app.config import settings


@pytest.mark.skipif(pdfplumber is None, reason="pdfplumber not installed")
def test_pdf_extraction_fixture():
    # Force local extraction path
    settings.AZURE_AI_KEY = "test-key"
    settings.AZURE_AI_ENDPOINT = "https://test.api.cognitive.microsoft.com/"

    fixture_path = Path(__file__).parent / "fixtures" / "sample_statement.pdf"
    assert fixture_path.exists()

    service = ExtractionService()
    data = service.extract(fixture_path.read_bytes(), "pdf", "test-org")

    assert data["raw_data"], "Expected rows from PDF fixture"
    assert len(data["column_headers"]) >= 2
    assert data.get("method") in {"pdfplumber-table", "pdfplumber-text", "ocr"}
