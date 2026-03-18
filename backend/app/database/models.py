import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, UUID, ForeignKey, Numeric, Integer, Text, Enum as SQLEnum, Index
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
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    bank_transactions = relationship("BankTransaction", back_populates="organization", cascade="all, delete-orphan")
    book_transactions = relationship("BookTransaction", back_populates="organization", cascade="all, delete-orphan")
    match_groups = relationship("MatchGroup", back_populates="organization", cascade="all, delete-orphan")
    fingerprints = relationship("IngestionFingerprint", back_populates="organization", cascade="all, delete-orphan")
    upload_sessions = relationship("UploadSession", back_populates="organization", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_organizations_slug", "slug"),)


class User(Base):
    """User model - team members within an organization."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    email = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), default="user")  # admin, user
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="users")


class BankTransaction(Base):
    """Bank statement transactions - "The Truth"."""

    __tablename__ = "bank_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    upload_session_id = Column(UUID(as_uuid=True), ForeignKey("upload_sessions.id"), nullable=True)

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

    # Relationships
    organization = relationship("Organization", back_populates="bank_transactions")
    match_group = relationship("MatchGroup", back_populates="bank_transactions")

    __table_args__ = (
        Index("ix_bank_transactions_org_id", "org_id"),
        Index("ix_bank_transactions_trans_date", "trans_date"),
        Index("ix_bank_transactions_match_group_id", "match_group_id"),
    )


class BookTransaction(Base):
    """Cash Book transactions - "The Record"."""

    __tablename__ = "book_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    upload_session_id = Column(UUID(as_uuid=True), ForeignKey("upload_sessions.id"), nullable=True)

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

    # Relationships
    organization = relationship("Organization", back_populates="book_transactions")
    match_group = relationship("MatchGroup", back_populates="book_transactions")

    __table_args__ = (
        Index("ix_book_transactions_org_id", "org_id"),
        Index("ix_book_transactions_trans_date", "trans_date"),
        Index("ix_book_transactions_match_group_id", "match_group_id"),
    )


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
    file_size = Column(Integer, nullable=False)  # bytes
    file_type = Column(String(50), nullable=False)  # pdf, xlsx, csv
    upload_source = Column(String(50), nullable=False)  # bank, book

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
    )
