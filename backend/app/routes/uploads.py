from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
)
from sqlalchemy.orm import Session
from uuid import UUID
import logging
from datetime import datetime
import hashlib
import json

from app.database import get_db
from app.database.models import (
    Organization,
    UploadSession,
    ReconciliationSession,
    BankTransaction,
    BookTransaction,
    ExtractionDraft,
    MatchGroup,
    User,
)
from app.dependencies.auth import ensure_org_access, get_admin_user, get_current_user
from app.observability import record_job_event
from app.schemas import (
    UploadSessionCreate,
    UploadSessionResponse,
    DataExtractionResponse,
    ProcessingJobResponse,
    ColumnMapping,
    BankTransactionResponse,
    BookTransactionResponse,
    ExtractionDraftResponse,
    ExtractionDraftMappingUpdateRequest,
    ExtractionDraftRegionUpdateRequest,
    ExtractionDraftRowsUpdateRequest,
    ExtractionDraftValidationSummary,
    ExtractionDraftFinalizeResponse,
)
from app.services.extraction_service import ExtractionService
from app.services.audit_service import audit_service
from app.services.file_storage_service import file_storage_service
from app.services.job_service import job_service, queue_extraction_job
from app.services.processing_service import ProcessingService
from app.services.pdf_draft_review_service import PdfDraftReviewService
from app.services.standardization_service import StandardizationService

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])
logger = logging.getLogger(__name__)

extraction_service = ExtractionService()
processing_service = ProcessingService()
standardization_service = StandardizationService()
pdf_draft_review_service = PdfDraftReviewService()


# ===== HELPER FUNCTIONS =====

def get_org_or_404(org_id: UUID, db: Session, current_user: User) -> Organization:
    """Get organization or raise 404."""
    ensure_org_access(org_id, current_user)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def get_upload_session_or_404(
    session_id: UUID,
    db: Session,
    current_user: User,
) -> UploadSession:
    """Get upload session or raise 404."""
    session = (
        db.query(UploadSession)
        .filter(
            UploadSession.id == session_id,
            UploadSession.org_id == current_user.org_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    return session


def clear_existing_session_transactions(session: UploadSession, db: Session) -> None:
    """Remove prior transactions and stale match groups before remapping a session."""
    transaction_model = (
        BankTransaction if session.upload_source == "bank" else BookTransaction
    )
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


def ensure_pdf_upload_session(session: UploadSession) -> None:
    if session.file_type != "pdf":
        raise HTTPException(
            status_code=400,
            detail="Extraction drafts are only available for PDF uploads.",
        )


def validate_period_month(period_month: str) -> str:
    period = (period_month or "").strip()
    if not period:
        raise HTTPException(status_code=400, detail="Recon month is required")
    try:
        datetime.strptime(period, "%Y-%m")
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Recon month must be in YYYY-MM format",
        ) from exc
    return period


async def resolve_session_file_content(
    session: UploadSession,
    upload_file: UploadFile | None,
) -> bytes:
    """Load file bytes from persistent storage, or fall back to the incoming upload."""
    if session.stored_file_path and file_storage_service.exists(session.stored_file_path):
        return file_storage_service.read_upload(session.stored_file_path)

    if upload_file is None:
        raise HTTPException(
            status_code=400,
            detail="Stored upload file was not found. Please upload the file again.",
        )

    file_content = await upload_file.read()
    file_name = upload_file.filename or session.file_name
    file_ext = file_name.split(".")[-1].lower()
    session.stored_file_path = file_storage_service.save_upload(
        org_id=session.org_id,
        session_id=session.id,
        file_ext=file_ext,
        content=file_content,
    )
    return file_content


# ===== ENDPOINTS =====

@router.post("/create-session/{org_id}", response_model=UploadSessionResponse)
async def create_upload_session(
    org_id: UUID,
    file: UploadFile = File(...),
    source: str = "bank",  # bank or book
    account_name: str = "",
    period_month: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Create an upload session and store file metadata.

    - **org_id**: Organization ID
    - **file**: The file to upload (PDF, XLSX, CSV)
    - **source**: 'bank' or 'book'
    """
    # Verify org exists
    org = get_org_or_404(org_id, db, current_user)
    normalized_account_name = (account_name or "").strip()
    if not normalized_account_name:
        raise HTTPException(status_code=400, detail="Account name is required")
    normalized_period_month = validate_period_month(period_month)

    closed_reconciliation_session = (
        db.query(ReconciliationSession)
        .filter(
            ReconciliationSession.org_id == org_id,
            ReconciliationSession.account_name == normalized_account_name,
            ReconciliationSession.period_month == normalized_period_month,
            ReconciliationSession.status == "closed",
        )
        .first()
    )
    if closed_reconciliation_session:
        raise HTTPException(
            status_code=400,
            detail="This reconciliation month is closed. Reopen a new month to add records.",
        )

    # Validate file type
    allowed_types = {"pdf", "xlsx", "xls", "csv"}
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type {file_ext} not supported")

    # Map file extension to type
    file_type_map = {"xls": "xlsx", "xlsx": "xlsx", "csv": "csv", "pdf": "pdf"}
    file_type = file_type_map.get(file_ext, file_ext)

    file_bytes = await file.read()
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    await file.seek(0)

    existing_session = db.query(UploadSession).filter(
        UploadSession.org_id == org_id,
        UploadSession.upload_source == source,
        UploadSession.account_name == normalized_account_name,
        UploadSession.period_month == normalized_period_month,
        UploadSession.file_hash == file_hash,
    ).order_by(UploadSession.created_at.desc()).first()

    if existing_session:
        if existing_session.status == "failed":
            existing_session.status = "uploaded"
            existing_session.error_message = None
        existing_session.file_name = file.filename
        existing_session.file_size = len(file_bytes)
        existing_session.file_type = file_type
        existing_session.account_name = normalized_account_name
        existing_session.period_month = normalized_period_month
        if not file_storage_service.exists(existing_session.stored_file_path):
            existing_session.stored_file_path = file_storage_service.save_upload(
                org_id=org_id,
                session_id=existing_session.id,
                file_ext=file_ext,
                content=file_bytes,
            )
        db.commit()
        db.refresh(existing_session)
        logger.info(
            "Reused existing upload session %s for org %s (%s)",
            existing_session.id,
            org_id,
            source,
        )
        audit_service.log(
            db=db,
            org_id=org.id,
            actor_user_id=current_user.id,
            action="upload.session.reused",
            entity_type="upload_session",
            entity_id=str(existing_session.id),
            metadata={
                "source": source,
                "file_name": file.filename,
                "account_name": normalized_account_name,
                "period_month": normalized_period_month,
            },
        )
        return UploadSessionResponse.model_validate(existing_session)

    # Create upload session
    upload_session = UploadSession(
        org_id=org_id,
        file_name=file.filename,
        file_hash=file_hash,
        file_size=len(file_bytes),
        stored_file_path="",
        file_type=file_type,
        upload_source=source,
        account_name=normalized_account_name,
        period_month=normalized_period_month,
        status="uploaded",
    )

    db.add(upload_session)
    db.flush()
    upload_session.stored_file_path = file_storage_service.save_upload(
        org_id=org_id,
        session_id=upload_session.id,
        file_ext=file_ext,
        content=file_bytes,
    )
    db.commit()
    db.refresh(upload_session)

    logger.info(f"Created upload session {upload_session.id} for org {org_id}")
    audit_service.log(
        db=db,
        org_id=org.id,
        actor_user_id=current_user.id,
        action="upload.session.created",
        entity_type="upload_session",
        entity_id=str(upload_session.id),
        metadata={
            "source": source,
            "file_name": file.filename,
            "file_type": file_type,
            "account_name": normalized_account_name,
            "period_month": normalized_period_month,
        },
    )

    return UploadSessionResponse.model_validate(upload_session)


@router.post("/extract/{session_id}", response_model=DataExtractionResponse)
async def extract_data(
    session_id: UUID,
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
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
    session = get_upload_session_or_404(session_id, db, current_user)

    try:
        file_content = await resolve_session_file_content(session, file)

        return processing_service.build_extraction_preview(
            session=session,
            file_content=file_content,
            db=db,
        )
    except Exception as e:
        logger.error(f"Extraction failed for session {session_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Extraction failed: {str(e)}")


@router.post("/extract-draft/{session_id}", response_model=ExtractionDraftResponse)
async def extract_draft(
    session_id: UUID,
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Create or resume a persisted PDF extraction draft for review."""
    session = get_upload_session_or_404(session_id, db, current_user)
    ensure_pdf_upload_session(session)

    try:
        file_content = await resolve_session_file_content(session, file)
        return pdf_draft_review_service.build_or_get_draft(
            session=session,
            file_content=file_content,
            current_user=current_user,
            db=db,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Draft extraction failed for session %s: %s", session_id, str(e))
        raise HTTPException(status_code=400, detail=f"Draft extraction failed: {str(e)}")


@router.get("/draft/by-session/{session_id}", response_model=ExtractionDraftResponse)
async def get_active_draft_for_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Fetch the latest active extraction draft for a PDF upload session."""
    session = get_upload_session_or_404(session_id, db, current_user)
    ensure_pdf_upload_session(session)

    draft = pdf_draft_review_service.get_active_draft_for_session(
        session_id=session.id,
        org_id=session.org_id,
        db=db,
    )
    if not draft:
        raise HTTPException(status_code=404, detail="No active extraction draft found")
    return pdf_draft_review_service.serialize_draft(draft)


@router.post("/extract-async/{session_id}", response_model=ProcessingJobResponse)
async def extract_data_async(
    session_id: UUID,
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Queue extraction work and return a polling job handle."""
    session = get_upload_session_or_404(session_id, db, current_user)
    if not session.stored_file_path or not file_storage_service.exists(session.stored_file_path):
        if file is None:
            raise HTTPException(
                status_code=400,
                detail="Stored upload file was not found. Please upload the file again.",
            )
        file_content = await file.read()
        file_ext = (file.filename or session.file_name).split(".")[-1].lower()
        session.stored_file_path = file_storage_service.save_upload(
            org_id=session.org_id,
            session_id=session.id,
            file_ext=file_ext,
            content=file_content,
        )
        db.commit()
        db.refresh(session)

    job, created = job_service.create_extraction_job(
        upload_session_id=session.id,
        org_id=session.org_id,
        actor_user_id=current_user.id,
        job_payload={
            "upload_session_id": str(session.id),
            "file_path": session.stored_file_path,
        },
        db=db,
    )

    if created:
        queue_extraction_job(job.id, session.id, session.stored_file_path or "")
        record_job_event("extraction", "enqueued")
        logger.info("Queued extraction job %s for session %s", job.id, session.id)
        audit_service.log(
            db=db,
            org_id=session.org_id,
            actor_user_id=current_user.id,
            action="job.enqueued",
            entity_type="processing_job",
            entity_id=str(job.id),
            metadata={
                "job_type": "extraction",
                "upload_session_id": str(session.id),
            },
        )
    else:
        logger.info("Reusing active extraction job %s for session %s", job.id, session.id)

    return job_service.serialize_job(job)


@router.patch("/draft/{draft_id}/mapping", response_model=ExtractionDraftResponse)
async def update_draft_mapping(
    draft_id: UUID,
    payload: ExtractionDraftMappingUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    try:
        draft = pdf_draft_review_service.get_draft_or_404(
            draft_id=draft_id,
            org_id=current_user.org_id,
            db=db,
        )
        return pdf_draft_review_service.update_mapping(
            draft=draft,
            mapping=payload.mapping,
            current_user=current_user,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/draft/{draft_id}/region", response_model=ExtractionDraftResponse)
async def update_draft_region(
    draft_id: UUID,
    payload: ExtractionDraftRegionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    try:
        draft = pdf_draft_review_service.get_draft_or_404(
            draft_id=draft_id,
            org_id=current_user.org_id,
            db=db,
        )
        return pdf_draft_review_service.update_region(
            draft=draft,
            payload=payload,
            current_user=current_user,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/draft/{draft_id}/rows", response_model=ExtractionDraftResponse)
async def update_draft_rows(
    draft_id: UUID,
    payload: ExtractionDraftRowsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    try:
        draft = pdf_draft_review_service.get_draft_or_404(
            draft_id=draft_id,
            org_id=current_user.org_id,
            db=db,
        )
        return pdf_draft_review_service.update_rows(
            draft=draft,
            payload=payload,
            current_user=current_user,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/draft/{draft_id}/validation", response_model=ExtractionDraftValidationSummary)
async def get_draft_validation(
    draft_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    try:
        draft = pdf_draft_review_service.get_draft_or_404(
            draft_id=draft_id,
            org_id=current_user.org_id,
            db=db,
        )
        return pdf_draft_review_service.validate_draft(draft)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/draft/{draft_id}/finalize", response_model=ExtractionDraftFinalizeResponse)
async def finalize_draft(
    draft_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    try:
        draft = pdf_draft_review_service.get_draft_or_404(
            draft_id=draft_id,
            org_id=current_user.org_id,
            db=db,
        )
        session = get_upload_session_or_404(draft.upload_session_id, db, current_user)
        ensure_pdf_upload_session(session)
        return pdf_draft_review_service.finalize_draft(
            draft=draft,
            session=session,
            current_user=current_user,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/confirm-mapping/{session_id}", response_model=dict)
async def confirm_mapping(
    session_id: UUID,
    column_mapping: str = Form(...),
    save_as_fingerprint: bool = Form(True),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    User confirms column mapping and uploads full file data.
    This triggers standardization of ALL rows.

    Returns: Count of standardized transactions
    """
    # Verify session exists
    session = get_upload_session_or_404(session_id, db, current_user)

    try:
        # Parse column mapping JSON from form field
        try:
            mapping_dict = json.loads(column_mapping)
            mapping = ColumnMapping(**mapping_dict)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid column_mapping: {str(e)}")

        if not mapping.debit or not mapping.credit:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Map both Debit and Credit columns. Single Amount mapping is no longer supported."
                ),
            )
        mapping.amount = None

        if session.file_type == "pdf":
            raise HTTPException(
                status_code=400,
                detail="PDF uploads now use the draft review workflow. Finalize the extraction draft instead of confirm-mapping.",
            )

        # Read full file from persistent storage whenever possible
        file_content = await resolve_session_file_content(session, file)

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

        clear_existing_session_transactions(session, db)

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
        session.error_message = None
        session.rows_standardized = transaction_count
        session.completed_at = datetime.utcnow()
        db.commit()

        logger.info(f"Standardized {transaction_count} transactions for session {session_id}")
        audit_service.log(
            db=db,
            org_id=session.org_id,
            actor_user_id=current_user.id,
            action="upload.mapping.confirmed",
            entity_type="upload_session",
            entity_id=str(session_id),
            metadata={
                "source": session.upload_source,
                "standardized_count": transaction_count,
            },
        )

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
    current_user: User = Depends(get_current_user),
):
    """Get upload session details."""
    session = get_upload_session_or_404(session_id, db, current_user)
    return UploadSessionResponse.model_validate(session)


@router.get("/transactions/{session_id}/bank", response_model=list[BankTransactionResponse])
async def get_bank_transactions(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all bank transactions from an upload session."""
    session = get_upload_session_or_404(session_id, db, current_user)

    transactions = db.query(BankTransaction).filter(
        BankTransaction.upload_session_id == session_id
    ).all()

    return [BankTransactionResponse.model_validate(tx) for tx in transactions]


@router.get("/transactions/{session_id}/book", response_model=list[BookTransactionResponse])
async def get_book_transactions(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all book transactions from an upload session."""
    session = get_upload_session_or_404(session_id, db, current_user)

    transactions = db.query(BookTransaction).filter(
        BookTransaction.upload_session_id == session_id
    ).all()

    return [BookTransactionResponse.model_validate(tx) for tx in transactions]
