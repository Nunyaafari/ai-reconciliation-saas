from app.schemas import ColumnMapping
from app.services.pdf_draft_review_service import PdfDraftReviewService


def test_build_validation_summary_flags_low_amount_coverage():
    service = PdfDraftReviewService()
    rows = service._build_rows(
        [
            ["2026-04-01", "Office supplies", "TXN001", "", ""],
            ["2026-04-02", "Utilities payment", "TXN002", "", ""],
        ],
        ["Date", "Description", "Reference", "Debit", "Credit"],
    )
    rows = service._apply_region_flags(rows, 0, 1)
    mapping = ColumnMapping(
        date="Date",
        narration="Description",
        reference="Reference",
        debit="Debit",
        credit="Credit",
    )

    summary = service._build_validation_summary(
        rows,
        ["Date", "Description", "Reference", "Debit", "Credit"],
        mapping,
    )

    assert any(issue.code == "amount_coverage_low" for issue in summary.issues)


def test_build_validation_summary_accepts_clean_debit_credit_rows():
    service = PdfDraftReviewService()
    rows = service._build_rows(
        [
            ["2026-04-01", "Office supplies", "TXN001", "120.50", ""],
            ["2026-04-02", "Deposit", "TXN002", "", "120.50"],
        ],
        ["Date", "Description", "Reference", "Debit", "Credit"],
    )
    rows = service._apply_region_flags(rows, 0, 1)
    mapping = ColumnMapping(
        date="Date",
        narration="Description",
        reference="Reference",
        debit="Debit",
        credit="Credit",
    )

    summary = service._build_validation_summary(
        rows,
        ["Date", "Description", "Reference", "Debit", "Credit"],
        mapping,
    )

    blocking = [issue for issue in summary.issues if issue.severity == "blocking"]
    assert blocking == []
    assert summary.totals["debit_total"] == 120.5
    assert summary.totals["credit_total"] == 120.5


def test_infer_row_type_marks_summary_rows():
    service = PdfDraftReviewService()

    assert (
        service._infer_row_type(["", "Closing balance", "", "", "1,500.00"])
        == "summary"
    )
