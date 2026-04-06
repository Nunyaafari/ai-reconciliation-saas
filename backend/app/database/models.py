import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, DateTime, UUID, ForeignKey, Numeric, Integer, Text, Enum as SQLEnum, Index, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()


class Organization(Base):
    """Organization/Tenant model - multi-tenant isolation."""

    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), nullable=False)
    company_address = Column(Text, nullable=True)
    company_logo_data_url = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    bank_transactions = relationship("BankTransaction", back_populates="organization", cascade="all, delete-orphan")
    book_transactions = relationship("BookTransaction", back_populates="organization", cascade="all, delete-orphan")
    match_groups = relationship("MatchGroup", back_populates="organization", cascade="all, delete-orphan")
    fingerprints = relationship("IngestionFingerprint", back_populates="organization", cascade="all, delete-orphan")
    upload_sessions = relationship("UploadSession", back_populates="organization", cascade="all, delete-orphan")
    reconciliation_sessions = relationship(
        "ReconciliationSession",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    processing_jobs = relationship(
        "ProcessingJob",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    audit_logs = relationship(
        "AuditLog",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    password_reset_tokens = relationship(
        "PasswordResetToken",
        back_populates="organization",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_organizations_slug", "slug"),)


class User(Base):
    """User model - team members within an organization."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user")  # admin, user
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="users")
    initiated_jobs = relationship(
        "ProcessingJob",
        back_populates="actor_user",
        foreign_keys="ProcessingJob.actor_user_id",
    )
    audit_logs = relationship(
        "AuditLog",
        back_populates="actor_user",
        foreign_keys="AuditLog.actor_user_id",
    )
    password_reset_tokens = relationship(
        "PasswordResetToken",
        back_populates="user",
        foreign_keys="PasswordResetToken.user_id",
    )


class BankTransaction(Base):
    """Bank statement transactions - "The Truth"."""

    __tablename__ = "bank_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    upload_session_id = Column(UUID(as_uuid=True), ForeignKey("upload_sessions.id"), nullable=True)
    reconciliation_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reconciliation_sessions.id"),
        nullable=True,
    )

    # Core fields (prescribed fields)
    trans_date = Column(DateTime, nullable=False)
    narration = Column(Text, nullable=False)
    reference = Column(String(255), nullable=True)  # Check no., etc.
    amount = Column(Numeric(15, 2), nullable=False)

    # Status
    match_group_id = Column(UUID(as_uuid=True), ForeignKey("match_groups.id"), nullable=True)
    status = Column(SQLEnum("unreconciled", "pending", "matched", name="tx_status"), default="unreconciled")

    # Metadata
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    is_removed = Column(Boolean, nullable=False, default=False)
    removed_at = Column(DateTime, nullable=True)
    is_carryforward = Column(Boolean, nullable=False, default=False)

    # Relationships
    organization = relationship("Organization", back_populates="bank_transactions")
    match_group = relationship("MatchGroup", back_populates="bank_transactions")
    reconciliation_session = relationship("ReconciliationSession", back_populates="carryforward_bank_transactions")

    __table_args__ = (
        Index("ix_bank_transactions_org_id", "org_id"),
        Index("ix_bank_transactions_trans_date", "trans_date"),
        Index("ix_bank_transactions_match_group_id", "match_group_id"),
        Index("ix_bank_transactions_reconciliation_session_id", "reconciliation_session_id"),
    )

    @property
    def direction(self) -> str | None:
        amount = Decimal(self.amount or 0)
        if amount > 0:
            return "credit"
        if amount < 0:
            return "debit"
        return None

    @property
    def debit_amount(self) -> Decimal:
        return abs(Decimal(self.amount or 0)) if self.direction == "debit" else Decimal("0")

    @property
    def credit_amount(self) -> Decimal:
        return abs(Decimal(self.amount or 0)) if self.direction == "credit" else Decimal("0")


class BookTransaction(Base):
    """Cash Book transactions - "The Record"."""

    __tablename__ = "book_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    upload_session_id = Column(UUID(as_uuid=True), ForeignKey("upload_sessions.id"), nullable=True)
    reconciliation_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reconciliation_sessions.id"),
        nullable=True,
    )

    # Core fields (prescribed fields)
    trans_date = Column(DateTime, nullable=False)
    narration = Column(Text, nullable=False)
    reference = Column(String(255), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)

    # Status
    match_group_id = Column(UUID(as_uuid=True), ForeignKey("match_groups.id"), nullable=True)
    status = Column(SQLEnum("unreconciled", "pending", "matched", name="tx_status"), default="unreconciled")

    # Metadata
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    is_removed = Column(Boolean, nullable=False, default=False)
    removed_at = Column(DateTime, nullable=True)
    is_carryforward = Column(Boolean, nullable=False, default=False)

    # Relationships
    organization = relationship("Organization", back_populates="book_transactions")
    match_group = relationship("MatchGroup", back_populates="book_transactions")
    reconciliation_session = relationship("ReconciliationSession", back_populates="carryforward_book_transactions")

    __table_args__ = (
        Index("ix_book_transactions_org_id", "org_id"),
        Index("ix_book_transactions_trans_date", "trans_date"),
        Index("ix_book_transactions_match_group_id", "match_group_id"),
        Index("ix_book_transactions_reconciliation_session_id", "reconciliation_session_id"),
    )

    @property
    def direction(self) -> str | None:
        amount = Decimal(self.amount or 0)
        if amount > 0:
            return "debit"
        if amount < 0:
            return "credit"
        return None

    @property
    def debit_amount(self) -> Decimal:
        return abs(Decimal(self.amount or 0)) if self.direction == "debit" else Decimal("0")

    @property
    def credit_amount(self) -> Decimal:
        return abs(Decimal(self.amount or 0)) if self.direction == "credit" else Decimal("0")


class MatchGroup(Base):
    """The "Bridge" table - represents a match between bank and book transactions."""

    __tablename__ = "match_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    # Match metadata
    match_type = Column(String(10), nullable=False)  # 1:1, 1:N, N:1, N:N
    total_bank_amount = Column(Numeric(15, 2), nullable=False)
    total_book_amount = Column(Numeric(15, 2), nullable=False)
    variance = Column(Numeric(15, 2), nullable=False, default=0)  # Should be 0

    # Scoring
    confidence_score = Column(Integer, nullable=False)  # 0-100
    status = Column(SQLEnum("pending", "approved", "rejected", name="match_status"), default="pending")

    # Comments & audit
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    approved_by_user_id = Column(UUID(as_uuid=True), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="match_groups")
    bank_transactions = relationship("BankTransaction", back_populates="match_group")
    book_transactions = relationship("BookTransaction", back_populates="match_group")

    __table_args__ = (
        Index("ix_match_groups_org_id", "org_id"),
        Index("ix_match_groups_status", "status"),
    )


class IngestionFingerprint(Base):
    """Learned patterns for PDF/Excel column mapping - "Memory" for the AI."""

    __tablename__ = "ingestion_fingerprints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    # File signature
    file_hash = Column(String(255), nullable=False)  # SHA256 of file structure
    file_name = Column(String(255), nullable=False)
    file_source = Column(String(50), nullable=False)  # bank, book, etc.

    # Learned mapping
    column_map = Column(Text, nullable=False)  # JSON: {"date": "Col_1", "narration": "Col_2", ...}
    ai_rules = Column(Text, nullable=True)  # JSON: {"if_contains": "...", "then_map_to": "..."}
    confidence = Column(Integer, nullable=False)  # 0-100: How confident this mapping is

    # Metadata
    uses_count = Column(Integer, default=0)  # Incremented each time used & confirmed
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="fingerprints")

    __table_args__ = (
        Index("ix_ingestion_fingerprints_org_id", "org_id"),
        Index("ix_ingestion_fingerprints_file_hash", "file_hash"),
    )


class UploadSession(Base):
    """Tracks upload history - one session per file upload."""

    __tablename__ = "upload_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    # Upload metadata
    file_name = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=True)
    stored_file_path = Column(String(512), nullable=True)
    file_size = Column(Integer, nullable=False)  # bytes
    file_type = Column(String(50), nullable=False)  # pdf, xlsx, csv
    upload_source = Column(String(50), nullable=False)  # bank, book
    account_name = Column(String(255), nullable=True)
    period_month = Column(String(7), nullable=True)  # YYYY-MM

    # Processing status
    status = Column(SQLEnum("uploaded", "extracting", "mapping", "reconciling", "complete", "failed", name="session_status"), default="uploaded")
    error_message = Column(Text, nullable=True)

    # Row counts
    rows_extracted = Column(Integer, nullable=True)
    rows_standardized = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="upload_sessions")
    bank_transactions = relationship("BankTransaction", foreign_keys=[BankTransaction.upload_session_id])
    book_transactions = relationship("BookTransaction", foreign_keys=[BookTransaction.upload_session_id])

    __table_args__ = (
        Index("ix_upload_sessions_org_id", "org_id"),
        Index("ix_upload_sessions_status", "status"),
        Index("ix_upload_sessions_file_hash", "file_hash"),
        Index("ix_upload_sessions_org_source_hash", "org_id", "upload_source", "file_hash"),
        Index("ix_upload_sessions_org_account_period", "org_id", "account_name", "period_month"),
    )


class ReconciliationSession(Base):
    """Monthly reconciliation session with opening/closing balances."""

    __tablename__ = "reconciliation_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    account_name = Column(String(255), nullable=False, default="Default Account")
    account_number = Column(String(100), nullable=True)
    period_month = Column(String(7), nullable=False)  # YYYY-MM
    bank_upload_session_id = Column(UUID(as_uuid=True), ForeignKey("upload_sessions.id"), nullable=True)
    book_upload_session_id = Column(UUID(as_uuid=True), ForeignKey("upload_sessions.id"), nullable=True)
    bank_open_balance = Column(Numeric(15, 2), nullable=False, default=0)
    bank_closing_balance = Column(Numeric(15, 2), nullable=False, default=0)
    bank_closing_balance_override = Column(Numeric(15, 2), nullable=True)
    book_open_balance = Column(Numeric(15, 2), nullable=False, default=0)
    book_closing_balance = Column(Numeric(15, 2), nullable=False, default=0)
    book_closing_balance_override = Column(Numeric(15, 2), nullable=True)
    company_name = Column(String(255), nullable=True)
    company_address = Column(Text, nullable=True)
    company_logo_data_url = Column(Text, nullable=True)
    prepared_by = Column(String(255), nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    currency_code = Column(String(10), nullable=False, default="GHS")
    status = Column(String(20), nullable=False, default="open")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)

    organization = relationship("Organization", back_populates="reconciliation_sessions")
    bank_upload_session = relationship("UploadSession", foreign_keys=[bank_upload_session_id])
    book_upload_session = relationship("UploadSession", foreign_keys=[book_upload_session_id])
    carryforward_bank_transactions = relationship(
        "BankTransaction",
        back_populates="reconciliation_session",
        foreign_keys="BankTransaction.reconciliation_session_id",
    )
    carryforward_book_transactions = relationship(
        "BookTransaction",
        back_populates="reconciliation_session",
        foreign_keys="BookTransaction.reconciliation_session_id",
    )

    __table_args__ = (
        Index("ix_reconciliation_sessions_org_id", "org_id"),
        Index("ix_reconciliation_sessions_account_name", "account_name"),
        Index("ix_reconciliation_sessions_period_month", "period_month"),
        Index("ix_reconciliation_sessions_status", "status"),
        Index(
            "ix_reconciliation_sessions_org_account_period",
            "org_id",
            "account_name",
            "period_month",
            unique=True,
        ),
    )


class ProcessingJob(Base):
    """Tracks async extraction and reconciliation work."""

    __tablename__ = "processing_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    upload_session_id = Column(UUID(as_uuid=True), ForeignKey("upload_sessions.id"), nullable=True)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    job_type = Column(String(50), nullable=False)  # extraction, reconciliation
    job_payload = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="queued")
    progress_percent = Column(Integer, nullable=False, default=0)
    attempt_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)
    message = Column(String(255), nullable=True)
    result_payload = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    last_retry_at = Column(DateTime, nullable=True)
    dead_lettered_at = Column(DateTime, nullable=True)

    organization = relationship("Organization", back_populates="processing_jobs")
    upload_session = relationship("UploadSession")
    actor_user = relationship("User", back_populates="initiated_jobs")

    __table_args__ = (
        Index("ix_processing_jobs_org_id", "org_id"),
        Index("ix_processing_jobs_upload_session_id", "upload_session_id"),
        Index("ix_processing_jobs_status", "status"),
        Index("ix_processing_jobs_job_type", "job_type"),
    )


class AuditLog(Base):
    """Persistent audit trail for security-sensitive user actions."""

    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(255), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="audit_logs")
    actor_user = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_logs_org_id", "org_id"),
        Index("ix_audit_logs_actor_user_id", "actor_user_id"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_created_at", "created_at"),
    )


class PasswordResetToken(Base):
    """Short-lived password reset token for a user."""

    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="password_reset_tokens")
    user = relationship("User", back_populates="password_reset_tokens")

    __table_args__ = (
        Index("ix_password_reset_tokens_org_id", "org_id"),
        Index("ix_password_reset_tokens_user_id", "user_id"),
        Index("ix_password_reset_tokens_expires_at", "expires_at"),
    )
