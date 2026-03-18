from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import UUID
import logging
from datetime import datetime
import json

from app.database import get_db
from app.database.models import (
    Organization,
    UploadSession,
    BankTransaction,
    BookTransaction,
)
from app.schemas import (
    UploadSessionCreate,
    UploadSessionResponse,
    DataExtractionResponse,
    ColumnMapping,
    BankTransactionResponse,
    BookTransactionResponse,
)
from app.services.extraction_service import ExtractionService
from app.services.standardization_service import StandardizationService

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])
logger = logging.getLogger(__name__)

extraction_service = ExtractionService()
standardization_service = StandardizationService()


# ===== HELPER FUNCTIONS =====

def get_org_or_404(org_id: UUID, db: Session) -> Organization:
    """Get organization or raise 404."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def get_upload_session_or_404(session_id: UUID, db: Session) -> UploadSession:
    """Get upload session or raise 404."""
    session = db.query(UploadSession).filter(UploadSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    return session


# ===== ENDPOINTS =====

@router.post("/create-session/{org_id}", response_model=UploadSessionResponse)
async def create_upload_session(
    org_id: UUID,
    file: UploadFile = File(...),
    source: str = "bank",  # bank or book
    db: Session = Depends(get_db),
):
    """
    Create an upload session and store file metadata.

    - **org_id**: Organization ID
    - **file**: The file to upload (PDF, XLSX, CSV)
    - **source**: 'bank' or 'book'
    """
    # Verify org exists
    org = get_org_or_404(org_id, db)

    # Validate file type
    allowed_types = {"pdf", "xlsx", "xls", "csv"}
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type {file_ext} not supported")

    # Map file extension to type
    file_type_map = {"xls": "xlsx", "xlsx": "xlsx", "csv": "csv", "pdf": "pdf"}
    file_type = file_type_map.get(file_ext, file_ext)

    # Create upload session
    upload_session = UploadSession(
        org_id=org_id,
        file_name=file.filename,
        file_size=len(await file.read()),
        file_type=file_type,
        upload_source=source,
        status="uploaded",
    )
    await file.seek(0)  # Reset file pointer

    db.add(upload_session)
    db.commit()
    db.refresh(upload_session)

    logger.info(f"Created upload session {upload_session.id} for org {org_id}")

    return UploadSessionResponse.from_orm(upload_session)


@router.post("/extract/{session_id}", response_model=DataExtractionResponse)
async def extract_data(
    session_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Extract raw data from uploaded file (PDF, XLSX, CSV).
    Returns first 5 rows + AI-guessed column mapping.

    This is the first step of data ingestion:
    1. Read file
    2. Extract tables/data
    3. AI guesses column mapping
    4. Return preview for user confirmation
    """
    # Verify session exists
    session = get_upload_session_or_404(session_id, db)

    # Update status
    session.status = "extracting"
    db.commit()

    try:
        # Read file content
        file_content = await file.read()

        # Call extraction service (Azure AI or local parser)
        extraction_result = extraction_service.extract(
            file_content=file_content,
            file_type=session.file_type,
            org_id=session.org_id,
        )

        if not extraction_result.get("raw_data") and not extraction_result.get("column_headers"):
            raise ValueError(
                "No rows detected. Please upload a clearer file or use CSV/XLSX."
            )

        # AI guess column mapping
        ai_mapping = extraction_service.guess_column_mapping(
            raw_data=extraction_result["raw_data"],
            org_id=session.org_id,
            column_headers=extraction_result.get("column_headers", []),
        )

        # Update session
        session.status = "mapping"
        session.rows_extracted = len(extraction_result["raw_data"])
        db.commit()

        return DataExtractionResponse(
            extraction_id=str(session_id),
            raw_data=extraction_result["raw_data"][:5],  # First 5 rows
            column_headers=extraction_result["column_headers"],
            ai_guess_mapping=ai_mapping,
            ai_confidence=extraction_result.get("confidence", 75),
            extraction_method=extraction_result.get("method", "unknown"),
        )

    except Exception as e:
        session.status = "failed"
        session.error_message = str(e)
        db.commit()
        logger.error(f"Extraction failed for session {session_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Extraction failed: {str(e)}")


@router.post("/confirm-mapping/{session_id}", response_model=dict)
async def confirm_mapping(
    session_id: UUID,
    column_mapping: str = Form(...),
    save_as_fingerprint: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    User confirms column mapping and uploads full file data.
    This triggers standardization of ALL rows.

    Returns: Count of standardized transactions
    """
    # Verify session exists
    session = get_upload_session_or_404(session_id, db)

    try:
        # Parse column mapping JSON from form field
        try:
            mapping_dict = json.loads(column_mapping)
            mapping = ColumnMapping(**mapping_dict)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid column_mapping: {str(e)}")

        # Read full file
        file_content = await file.read()

        # Extract all data
        extraction_result = extraction_service.extract(
            file_content=file_content,
            file_type=session.file_type,
            org_id=session.org_id,
        )

        # Convert raw rows into dicts keyed by column headers
        column_headers = extraction_result.get("column_headers") or []
        if not column_headers:
            max_cols = max((len(r) for r in extraction_result["raw_data"]), default=0)
            column_headers = [f"Col_{i+1}" for i in range(max_cols)]

        raw_rows = []
        for row in extraction_result["raw_data"]:
            row_dict = {}
            for idx, value in enumerate(row):
                key = column_headers[idx] if idx < len(column_headers) else f"Col_{idx+1}"
                row_dict[key] = value
            raw_rows.append(row_dict)

        # Standardize all rows
        standardized = standardization_service.standardize(
            raw_transactions=raw_rows,
            column_mapping=mapping,
            source=session.upload_source,
        )

        # Store standardized transactions in DB
        transaction_count = 0
        if session.upload_source == "bank":
            for tx_data in standardized:
                tx = BankTransaction(
                    org_id=session.org_id,
                    upload_session_id=session_id,
                    trans_date=datetime.fromisoformat(tx_data["trans_date"]),
                    narration=tx_data["narration"],
                    reference=tx_data.get("reference"),
                    amount=tx_data["amount"],
                    status="unreconciled",
                )
                db.add(tx)
                transaction_count += 1
        else:  # book
            for tx_data in standardized:
                tx = BookTransaction(
                    org_id=session.org_id,
                    upload_session_id=session_id,
                    trans_date=datetime.fromisoformat(tx_data["trans_date"]),
                    narration=tx_data["narration"],
                    reference=tx_data.get("reference"),
                    amount=tx_data["amount"],
                    status="unreconciled",
                )
                db.add(tx)
                transaction_count += 1

        # Save fingerprint if requested (for future learning)
        if save_as_fingerprint:
            standardization_service.save_fingerprint(
                org_id=str(session.org_id),
                file_name=session.file_name,
                column_mapping=mapping,
                db=db,
            )

        # Update session
        session.status = "complete"
        session.rows_standardized = transaction_count
        session.completed_at = datetime.utcnow()
        db.commit()

        logger.info(f"Standardized {transaction_count} transactions for session {session_id}")

        return {
            "status": "success",
            "standardized_count": transaction_count,
            "session_id": str(session_id),
        }

    except Exception as e:
        session.status = "failed"
        session.error_message = str(e)
        db.commit()
        logger.error(f"Standardization failed for session {session_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Standardization failed: {str(e)}")


@router.get("/session/{session_id}", response_model=UploadSessionResponse)
async def get_upload_session(
    session_id: UUID,
    db: Session = Depends(get_db),
):
    """Get upload session details."""
    session = get_upload_session_or_404(session_id, db)
    return UploadSessionResponse.from_orm(session)


@router.get("/transactions/{session_id}/bank", response_model=list[BankTransactionResponse])
async def get_bank_transactions(
    session_id: UUID,
    db: Session = Depends(get_db),
):
    """Get all bank transactions from an upload session."""
    session = get_upload_session_or_404(session_id, db)

    transactions = db.query(BankTransaction).filter(
        BankTransaction.upload_session_id == session_id
    ).all()

    return [BankTransactionResponse.from_orm(tx) for tx in transactions]


@router.get("/transactions/{session_id}/book", response_model=list[BookTransactionResponse])
async def get_book_transactions(
    session_id: UUID,
    db: Session = Depends(get_db),
):
    """Get all book transactions from an upload session."""
    session = get_upload_session_or_404(session_id, db)

    transactions = db.query(BookTransaction).filter(
        BookTransaction.upload_session_id == session_id
    ).all()

    return [BookTransactionResponse.from_orm(tx) for tx in transactions]
