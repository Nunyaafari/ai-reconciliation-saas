from pydantic import BaseModel, Field, field_validator, AliasChoices
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID


# ===== TRANSACTION SCHEMAS =====

class TransactionBase(BaseModel):
    """Base schema for transactions."""

    trans_date: str  # ISO format: YYYY-MM-DD
    narration: str
    reference: Optional[str] = None
    amount: Decimal


class BankTransactionCreate(TransactionBase):
    """Create a new bank transaction."""

    pass


class BookTransactionCreate(TransactionBase):
    """Create a new book transaction."""

    pass


class BankTransactionResponse(TransactionBase):
    """Response schema for bank transaction."""

    id: UUID
    org_id: UUID
    direction: Optional[str] = None
    debit_amount: Decimal = Decimal("0")
    credit_amount: Decimal = Decimal("0")
    status: str  # unreconciled, pending, matched
    match_group_id: Optional[UUID] = None
    created_at: datetime
    is_removed: bool = False
    removed_at: Optional[datetime] = None
    is_carryforward: bool = False

    @field_validator("trans_date", mode="before")
    @classmethod
    def serialize_trans_date(cls, value: Any) -> str:
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d")
        if isinstance(value, date):
            return value.isoformat()
        return str(value)

    class Config:
        from_attributes = True


class BookTransactionResponse(TransactionBase):
    """Response schema for book transaction."""

    id: UUID
    org_id: UUID
    direction: Optional[str] = None
    debit_amount: Decimal = Decimal("0")
    credit_amount: Decimal = Decimal("0")
    status: str
    match_group_id: Optional[UUID] = None
    created_at: datetime
    is_removed: bool = False
    removed_at: Optional[datetime] = None
    is_carryforward: bool = False

    @field_validator("trans_date", mode="before")
    @classmethod
    def serialize_trans_date(cls, value: Any) -> str:
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d")
        if isinstance(value, date):
            return value.isoformat()
        return str(value)

    class Config:
        from_attributes = True


class ManualTransactionCreate(BaseModel):
    """Manual entry added during reconciliation."""

    bucket: Literal["bank_debit", "bank_credit", "book_debit", "book_credit"]
    trans_date: str  # ISO format: YYYY-MM-DD
    narration: str
    reference: Optional[str] = None
    amount: Decimal


# ===== MATCH GROUP SCHEMAS =====

class MatchGroupCreate(BaseModel):
    """Create a match between transactions."""

    bank_transaction_ids: List[UUID]
    book_transaction_ids: List[UUID]
    confidence_score: int = Field(ge=0, le=100)
    notes: Optional[str] = None


class MatchGroupResponse(BaseModel):
    """Response schema for match group."""

    id: UUID
    org_id: UUID
    bank_transaction_ids: List[UUID] = Field(default_factory=list)
    book_transaction_ids: List[UUID] = Field(default_factory=list)
    match_type: str  # 1:1, 1:N, N:1, N:N
    total_bank_amount: Decimal
    total_book_amount: Decimal
    variance: Decimal
    confidence_score: int
    status: str  # pending, approved, rejected
    notes: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MatchGroupApprove(BaseModel):
    """Approve a match group."""

    notes: Optional[str] = None


class MatchGroupBulkApproveRequest(BaseModel):
    """Approve multiple match groups in one request."""

    match_ids: List[UUID] = Field(
        default_factory=list,
        validation_alias=AliasChoices("matchIds", "match_ids"),
    )
    notes: Optional[str] = None

    @field_validator("match_ids", mode="before")
    def normalize_match_ids(cls, value):
        if value is None:
            return []
        if not isinstance(value, list):
            return []
        normalized: list[UUID] = []
        for item in value:
            try:
                normalized.append(UUID(str(item)))
            except Exception:
                continue
        return normalized

    class Config:
        populate_by_name = True


class MatchGroupBulkApproveResponse(BaseModel):
    """Bulk approval response."""

    approved_ids: List[UUID]
    failed_ids: List[UUID]


# ===== UPLOAD SESSION SCHEMAS =====

class UploadSessionCreate(BaseModel):
    """Create an upload session."""

    file_name: str
    file_size: int  # bytes
    file_type: str  # pdf, xlsx, csv
    upload_source: str  # bank, book
    account_name: Optional[str] = None
    period_month: Optional[str] = None


class UploadSessionResponse(BaseModel):
    """Response schema for upload session."""

    id: UUID
    org_id: UUID
    file_name: str
    file_hash: Optional[str] = None
    file_type: str
    upload_source: str
    account_name: Optional[str] = None
    period_month: Optional[str] = None
    status: str  # uploaded, extracting, mapping, reconciling, complete, failed
    rows_extracted: Optional[int] = None
    rows_standardized: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== COLUMN MAPPING SCHEMAS =====

class ColumnMapping(BaseModel):
    """Column mapping for data extraction."""

    date: str
    narration: str
    reference: str
    amount: Optional[str] = None
    debit: Optional[str] = None
    credit: Optional[str] = None
    signed_amount_mode: Optional[Literal["debit_positive", "credit_positive"]] = None


class DataExtractionRequest(BaseModel):
    """Request for extracting data from uploaded file."""

    upload_session_id: UUID
    file_content: bytes  # Base64 encoded file
    file_type: str  # pdf, xlsx, csv


class ColumnPreviewMetric(BaseModel):
    """Column-level summary metrics for mapping preview."""

    non_empty_count: int = 0
    parsed_amount_count: int = 0
    parsed_amount_total: float = 0.0


class DataExtractionResponse(BaseModel):
    """Response from extraction - first 5 rows for preview."""

    extraction_id: str
    raw_data: List[List[Any]]  # 2D array of first 5 rows
    column_headers: List[str]
    ai_guess_mapping: ColumnMapping
    ai_confidence: int  # 0-100
    extraction_method: str
    total_rows: int = 0
    column_metrics: Dict[str, ColumnPreviewMetric] = Field(default_factory=dict)


class ExtractionDraftRow(BaseModel):
    """Editable row persisted for PDF extraction review."""

    row_index: int
    cells: List[Any]
    row_type: Literal["header", "transaction", "footer", "summary", "unknown", "deleted"]
    warnings: List[str] = Field(default_factory=list)
    confidence: int = 0
    is_repeated_header: bool = False
    is_within_selected_region: bool = False
    provenance: Optional[str] = None


class ExtractionDraftValidationIssue(BaseModel):
    """Validation issue surfaced during draft review."""

    code: str
    severity: Literal["blocking", "warning", "info"] = "warning"
    message: str
    row_indices: List[int] = Field(default_factory=list)


class ExtractionDraftValidationSummary(BaseModel):
    """Current validation state for an extraction draft."""

    totals: Dict[str, float] = Field(default_factory=dict)
    parse_coverage: Dict[str, float] = Field(default_factory=dict)
    suspicious_row_count: int = 0
    issues: List[ExtractionDraftValidationIssue] = Field(default_factory=list)


class ExtractionDraftResponse(BaseModel):
    """Full extraction draft response used by PDF review workflow."""

    id: UUID
    upload_session_id: UUID
    org_id: UUID
    version: int
    source_method: str
    confidence: int
    status: str
    column_headers: List[str] = Field(default_factory=list)
    mapped_fields: ColumnMapping
    raw_rows: List[ExtractionDraftRow] = Field(default_factory=list)
    reviewed_rows: List[ExtractionDraftRow] = Field(default_factory=list)
    header_row_index: Optional[int] = None
    table_start_row_index: Optional[int] = None
    table_end_row_index: Optional[int] = None
    validation_summary: ExtractionDraftValidationSummary = Field(
        default_factory=ExtractionDraftValidationSummary
    )
    created_at: datetime
    updated_at: datetime
    finalized_at: Optional[datetime] = None


class ExtractionDraftMappingUpdateRequest(BaseModel):
    """Update mapped fields on a persisted extraction draft."""

    mapping: ColumnMapping


class ExtractionDraftRegionUpdateRequest(BaseModel):
    """Update reviewed header/transaction region boundaries."""

    header_row_index: Optional[int] = None
    table_start_row_index: Optional[int] = None
    table_end_row_index: Optional[int] = None


class ExtractionDraftRowEdit(BaseModel):
    """Single row/cell update for extraction draft review."""

    row_index: int
    cells: Optional[List[Any]] = None
    row_type: Optional[Literal["header", "transaction", "footer", "summary", "unknown", "deleted"]] = None
    is_repeated_header: Optional[bool] = None
    is_within_selected_region: Optional[bool] = None


class ExtractionDraftRowsUpdateRequest(BaseModel):
    """Bulk row edits for a draft review grid."""

    edits: List[ExtractionDraftRowEdit] = Field(default_factory=list)


class ExtractionDraftFinalizeResponse(BaseModel):
    """Result of finalizing a reviewed PDF extraction draft."""

    status: str
    standardized_count: int
    session_id: str
    draft_id: UUID
    bucket_summaries: Dict[str, Dict[str, float]] = Field(default_factory=dict)


class ProcessingJobResponse(BaseModel):
    """Response schema for async extraction/reconciliation jobs."""

    id: UUID
    org_id: Optional[UUID] = None
    upload_session_id: Optional[UUID] = None
    job_type: str
    status: str
    progress_percent: int
    attempt_count: int = 0
    max_retries: int = 0
    message: Optional[str] = None
    result_payload: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_retry_at: Optional[datetime] = None
    dead_lettered_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ColumnMappingConfirm(BaseModel):
    """User confirms the column mapping."""

    column_mapping: ColumnMapping
    save_as_fingerprint: bool = True  # Remember this pattern


# ===== STANDARDIZATION SCHEMAS =====

class TransactionStandardizationRequest(BaseModel):
    """Request to standardize transactions."""

    upload_session_id: UUID
    raw_transactions: List[Dict[str, Any]]
    column_mapping: ColumnMapping


class StandardizedTransactionResponse(BaseModel):
    """Response with standardized transactions."""

    transactions: List[TransactionBase]
    standardization_errors: List[Dict[str, Any]] = []


# ===== RECONCILIATION SCHEMAS =====

class ReconciliationRequest(BaseModel):
    """Request to start reconciliation matching."""

    bank_upload_session_id: UUID
    book_upload_session_id: UUID


class ReconciliationBucketSummary(BaseModel):
    """Count and value summary for a directional bucket."""

    count: int
    total: Decimal


class ReconciliationBalanceUpdateRequest(BaseModel):
    """Editable opening and optional closing balances for a reconciliation session."""

    bank_open_balance: Decimal
    book_open_balance: Decimal
    bank_closing_balance: Optional[Decimal] = None
    book_closing_balance: Optional[Decimal] = None
    account_number: Optional[str] = None
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_logo_data_url: Optional[str] = None
    prepared_by: Optional[str] = None
    reviewed_by: Optional[str] = None
    currency_code: Optional[str] = None


class TransactionRemovalUpdateRequest(BaseModel):
    """Bulk toggle whether outstanding transactions are excluded from carryforward."""

    bank_transaction_ids: List[UUID] = Field(default_factory=list)
    book_transaction_ids: List[UUID] = Field(default_factory=list)
    removed: bool = True


class ReconciliationSessionResponse(BaseModel):
    """Monthly reconciliation session details."""

    id: UUID
    org_id: UUID
    account_name: str
    account_number: Optional[str] = None
    period_month: str
    bank_upload_session_id: Optional[UUID] = None
    book_upload_session_id: Optional[UUID] = None
    bank_open_balance: Decimal
    bank_closing_balance: Decimal
    book_open_balance: Decimal
    book_closing_balance: Decimal
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_logo_data_url: Optional[str] = None
    prepared_by: Optional[str] = None
    reviewed_by: Optional[str] = None
    currency_code: str = "GHS"
    status: str
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReconciliationBlankPeriodRequest(BaseModel):
    """Request to open a blank reconciliation period for an account."""

    period_month: str  # YYYY-MM


class ReconciliationCloseResponse(BaseModel):
    """Result of closing a month and seeding the next month."""

    closed_session: ReconciliationSessionResponse
    next_session: Optional[ReconciliationSessionResponse] = None


class ReconciliationSummaryResponse(BaseModel):
    """Summary of unresolved debit/credit lanes and adjusted balances."""

    period_month: str
    net_bank_movement: Decimal
    net_book_movement: Decimal
    bank_open_balance: Decimal
    bank_closing_balance: Decimal
    book_open_balance: Decimal
    book_closing_balance: Decimal
    bank_debit_subtotal: Decimal
    bank_credit_subtotal: Decimal
    book_debit_subtotal: Decimal
    book_credit_subtotal: Decimal
    lane_one_difference: Decimal
    lane_two_difference: Decimal
    adjusted_bank_balance: Decimal
    adjusted_book_balance: Decimal
    difference: Decimal
    unresolved_bank_debits: ReconciliationBucketSummary
    unresolved_bank_credits: ReconciliationBucketSummary
    unresolved_book_debits: ReconciliationBucketSummary
    unresolved_book_credits: ReconciliationBucketSummary


class MatchSuggestion(BaseModel):
    """AI suggestion for a match."""

    book_transaction_id: UUID
    confidence_score: int
    match_signals: Dict[str, float]  # value, date, reference, narration scores
    explanation: str


class UnmatchedTransactionWithSuggestions(BaseModel):
    """Unmatched transaction with AI suggestions."""

    bank_transaction_id: UUID
    bank_transaction: BankTransactionResponse
    suggestions: List[MatchSuggestion]


class ReconciliationStatusResponse(BaseModel):
    """Status of reconciliation progress."""

    total_bank_transactions: int
    matched_bank_transactions: int
    total_book_transactions: int
    matched_book_transactions: int
    unmatched_suggestions: List[UnmatchedTransactionWithSuggestions]
    match_groups: List[MatchGroupResponse]
    progress_percent: int
    reconciliation_session: Optional[ReconciliationSessionResponse] = None
    summary: Optional[ReconciliationSummaryResponse] = None
    bank_transactions: List[BankTransactionResponse] = Field(default_factory=list)
    book_transactions: List[BookTransactionResponse] = Field(default_factory=list)


class ReconciliationReportRequest(BaseModel):
    """Request to generate reconciliation report."""

    bank_upload_session_id: UUID
    book_upload_session_id: UUID
    report_format: str = "pdf"  # pdf, excel


# ===== INGESTION FINGERPRINT SCHEMAS =====

class IngestionFingerprintResponse(BaseModel):
    """Learned pattern for column mapping."""

    id: UUID
    file_hash: str
    column_map: ColumnMapping
    confidence: int
    uses_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ===== ERROR SCHEMAS =====

class ErrorResponse(BaseModel):
    """Standard error response."""

    error: str
    detail: Optional[str] = None
    error_code: Optional[str] = None


# ===== ORGANIZATION SCHEMAS =====

class OrganizationCreate(BaseModel):
    """Create a new organization."""

    name: str
    slug: str
    email: str


class OrganizationBootstrap(BaseModel):
    """Optional payload for creating or fetching a default organization."""

    name: Optional[str] = None
    slug: Optional[str] = None
    email: Optional[str] = None


class OrganizationResponse(BaseModel):
    """Response schema for organization."""

    id: UUID
    name: str
    slug: str
    email: str
    company_address: Optional[str] = None
    company_logo_data_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationUpdate(BaseModel):
    """Editable workspace organization metadata."""

    name: Optional[str] = None
    company_address: Optional[str] = None
    company_logo_data_url: Optional[str] = None

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """Authenticated user profile."""

    id: UUID
    org_id: UUID
    email: str
    name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    """Create a new organization admin and issue a session token."""

    name: str
    email: str
    password: str = Field(min_length=8)
    organization_name: str
    organization_slug: Optional[str] = None


class LoginRequest(BaseModel):
    """Authenticate an existing user."""

    email: str
    password: str


class AuthSessionResponse(BaseModel):
    """JWT auth response with the current user and organization context."""

    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: UserResponse
    organization: OrganizationResponse


class CreateUserRequest(BaseModel):
    """Create a team member inside the current organization."""

    name: str
    email: str
    password: str = Field(min_length=8)
    role: str = Field(pattern="^(admin|reviewer)$")


class ChangePasswordRequest(BaseModel):
    """Authenticated password change."""

    current_password: str
    new_password: str = Field(min_length=8)


class PasswordResetRequest(BaseModel):
    """Start a password reset flow for an email address."""

    email: str


class PasswordResetConfirmRequest(BaseModel):
    """Confirm a password reset using a reset token."""

    token: str
    new_password: str = Field(min_length=8)


class PasswordResetResponse(BaseModel):
    """Response for password reset operations."""

    status: str
    message: str
    reset_token: Optional[str] = None


class AuditLogResponse(BaseModel):
    """Persistent audit trail entry."""

    id: UUID
    org_id: UUID
    actor_user_id: Optional[UUID] = None
    actor_user_name: Optional[str] = None
    actor_user_email: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True
