# FastAPI Backend - AI Reconciliation SaaS

Production-ready FastAPI backend with PostgreSQL, handling document extraction, data standardization, and intelligent transaction matching.

## 🚀 Quick Start

### 1. Setup Environment

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

### 2. Configure Database

```bash
# Option A: Local PostgreSQL
createdb reconciliation
# Update DATABASE_URL in .env

# Option B: Supabase (Production)
# Get connection string from dashboard
# Update DATABASE_URL in .env
```

### 3. Run Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Visit http://localhost:8000/docs for interactive API documentation (Swagger UI)

---

## 📁 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app + middleware setup
│   ├── config.py                  # Environment config
│   ├── schemas.py                 # Pydantic models (request/response)
│   │
│   ├── database/
│   │   ├── __init__.py            # DB connection & session management
│   │   └── models.py              # SQLAlchemy models (tables)
│   │
│   ├── routes/                    # API endpoints
│   │   ├── __init__.py
│   │   ├── uploads.py             # File upload & extraction endpoints
│   │   └── reconciliation.py      # Matching & reconciliation endpoints
│   │
│   └── services/                  # Business logic layer
│       ├── __init__.py
│       ├── extraction_service.py  # PDF/Excel extraction
│       ├── standardization_service.py  # Data cleaning
│       └── matching_service.py    # Core matching algorithm
│
├── requirements.txt               # Python dependencies
├── .env.example                   # Environment template
└── README.md
```

---

## 🗄️ Database Schema

### Organizations (Multi-tenant)
```sql
organizations
├── id (UUID, PK)
├── name (String)
├── slug (String, unique)
└── email (String)
```

### Users
```sql
users
├── id (UUID, PK)
├── org_id (FK → organizations)
├── email (String)
├── name (String)
└── role (String: admin | user)
```

### Upload Sessions
```sql
upload_sessions
├── id (UUID, PK)
├── org_id (FK)
├── file_name (String)
├── file_type (String: pdf | xlsx | csv)
├── upload_source (String: bank | book)
├── status (Enum: uploaded | extracting | mapping | reconciling | complete | failed)
├── rows_extracted (Integer)
└── rows_standardized (Integer)
```

### Bank Transactions
```sql
bank_transactions
├── id (UUID, PK)
├── org_id (FK)
├── trans_date (DateTime)
├── narration (Text)
├── reference (String, nullable)
├── amount (Decimal)
├── match_group_id (FK → match_groups, nullable)
└── status (Enum: unreconciled | pending | matched)
```

### Book Transactions (Same as Bank)
```sql
book_transactions
├── [Same fields as bank_transactions]
```

### Match Groups (The "Bridge")
```sql
match_groups
├── id (UUID, PK)
├── org_id (FK)
├── match_type (String: 1:1 | 1:N | N:1)
├── total_bank_amount (Decimal)
├── total_book_amount (Decimal)
├── variance (Decimal)  # Should be 0
├── confidence_score (Integer: 0-100)
├── status (Enum: pending | approved | rejected)
└── approved_at (DateTime, nullable)
```

### Ingestion Fingerprints (Learned Patterns)
```sql
ingestion_fingerprints
├── id (UUID, PK)
├── org_id (FK)
├── file_hash (String)
├── column_map (JSON)            # {"date": "Col_1", "narration": "Col_2", ...}
├── confidence (Integer: 0-100)
├── uses_count (Integer)
└── last_used_at (DateTime)
```

---

## 🔌 API Endpoints

### Health Check
```
GET /health
```

### File Upload & Extraction

**Upload a file and create extraction session:**
```
POST /api/uploads/create-session/{org_id}
Params:
  - file: UploadFile (PDF, XLSX, CSV)
  - source: str (bank | book)

Response: UploadSessionResponse
```

**Extract data and get column mapping preview:**
```
POST /api/uploads/extract/{session_id}
Params:
  - file: UploadFile

Response: DataExtractionResponse
  {
    extraction_id: str
    raw_data: List[List[Any]]  # First 5 rows
    column_headers: List[str]
    ai_guess_mapping: ColumnMapping
    ai_confidence: int (0-100)
  }
```

**Confirm column mapping and standardize full file:**
```
POST /api/uploads/confirm-mapping/{session_id}
Body: ColumnMappingConfirm
  {
    column_mapping: ColumnMapping,
    save_as_fingerprint: bool
  }

Response:
  {
    status: "success",
    standardized_count: int
  }
```

### Reconciliation & Matching

**Start reconciliation (run matching algorithm):**
```
POST /api/reconciliation/start/{org_id}
Body: ReconciliationRequest
  {
    bank_upload_session_id: UUID,
    book_upload_session_id: UUID
  }

Response: ReconciliationStatusResponse
  {
    total_bank_transactions: int,
    matched_bank_transactions: int,
    total_book_transactions: int,
    matched_book_transactions: int,
    progress_percent: int,
    unmatched_suggestions: List[UnmatchedTransactionWithSuggestions],
    match_groups: List[MatchGroupResponse]
  }
```

**Create manual match:**
```
POST /api/reconciliation/match/{org_id}
Body: MatchGroupCreate
  {
    bank_transaction_ids: List[UUID],
    book_transaction_ids: List[UUID],
    confidence_score: int (0-100)
  }

Response: MatchGroupResponse
```

**Approve a match:**
```
POST /api/reconciliation/match/{match_id}/approve
Body: MatchGroupApprove
  {
    notes: Optional[str]
  }

Response: MatchGroupResponse (with status="approved")
```

**Reject/Delete a match:**
```
DELETE /api/reconciliation/match/{match_id}

Response: {"status": "success"}
```

---

## 🧮 Core Matching Algorithm

The system uses a **weighted confidence scoring system**:

```
Confidence Score = (50% × Value) + (20% × Date) + (20% × Reference) + (10% × Narration)
```

### Signal Calculations

**Value Signal (50% weight):**
- Exact match → 1.0 (100%)
- Different → 0.0 (0%)

**Date Signal (20% weight):**
```
0 days difference   → 1.0 (100%)
1-3 days            → 0.8 (80%)
4-7 days            → 0.4 (40%)
7+ days             → 0.0 (0%)
```

**Reference Signal (20% weight):**
- Exact match → 1.0 (100%)
- One missing → 0.5 (50%)
- Different → 0.0 (0%)

**Narration Signal (10% weight):**
- Uses RapidFuzz fuzzy string matching (0-1.0 based on similarity)

### Confidence Tiers

- **95-100%**: 🚀 High Confidence → Auto-approve
- **70-94%**: 🟡 Medium Confidence → User reviews suggestion
- **<70%**: 🔴 Low Confidence → Manual review

---

## 📦 Key Services

### ExtractionService (`services/extraction_service.py`)

Handles file parsing for PDF, Excel, CSV:

```python
extraction_service.extract(
    file_content: bytes,
    file_type: str,  # "pdf" | "xlsx" | "csv"
    org_id: str
) → {"raw_data": [...], "column_headers": [...]}

extraction_service.guess_column_mapping(
    raw_data: List[List[str]],
    org_id: str
) → ColumnMapping
```

**Production Implementation:**
- PDFs: Azure AI Document Intelligence (handles variable layouts)
- Excel: openpyxl for direct table extraction
- CSV: Native Python CSV parsing

### StandardizationService (`services/standardization_service.py`)

Cleans and normalizes data to prescribed fields:

```python
standardization_service.standardize(
    raw_transactions: List[Dict],
    column_mapping: ColumnMapping
) → List[Dict]  # Standardized transactions

standardization_service.save_fingerprint(
    org_id: str,
    file_name: str,
    column_mapping: ColumnMapping,
    db: Session
) → None  # Saves learned pattern
```

Features:
- Date format standardization (any format → YYYY-MM-DD)
- Amount parsing (handles $, commas, bracket notation)
- Narration cleaning (removes bank jargon)
- Reference normalization

### MatchingService (`services/matching_service.py`)

Core matching engine:

```python
matching_service.match_transactions(
    bank_transactions: List[BankTransaction],
    book_transactions: List[BookTransaction],
    org_id: str
) → List[Dict]  # Match results

matching_service.calculate_confidence_score(
    bank_tx: BankTransaction,
    book_tx: BookTransaction
) → float  # 0-100 confidence

matching_service.get_suggestions_for_transaction(
    bank_tx: BankTransaction,
    available_book_txs: List[BookTransaction]
) → List[Dict]  # Top 3 suggestions
```

Algorithms:
- **Phase 1**: Deterministic matching (exact value + reference OR very similar narration)
- **Phase 2**: Probabilistic matching (fuzzy scoring)
- **Phase 3**: Many-to-One matching (finds combinations that sum to target amount)

---

## 🔧 Configuration

### Environment Variables (`.env`)

```python
# Database
DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/reconciliation

# APIs
OPENAI_API_KEY=sk-...                    # For narration cleaning
AZURE_AI_KEY=your-key                    # For PDF extraction
AZURE_AI_ENDPOINT=https://region.api...  # Azure endpoint

# App
DEBUG=True
APP_NAME=AI Reconciliation SaaS
VERSION=0.1.0

# Auth
CLERK_SECRET_KEY=your-clerk-key

# CORS
CORS_ORIGINS=["http://localhost:3001"]
```

---

## 🧪 Testing

### Setup Test Database

```bash
# Create test db
createdb reconciliation_test

# Update .env.test
DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/reconciliation_test
```

### Run Tests

```bash
pytest tests/
```

Tests include:
- Data extraction and standardization
- Matching algorithm
- Confidence scoring
- Many-to-One matching
- API endpoint validation

---

## 📊 Performance Considerations

- **Database**: Indexed on org_id, trans_date, match_group_id for fast lookups
- **Matching**: O(n×m) for n bank + m book transactions (optimized with early matching)
- **Many-to-One**: Limited to 5-transaction combinations (configurable)
- **Connection Pool**: 20 connections, 40 overflow for production load

---

## 🚀 Deployment

### Local Development

```bash
uvicorn app.main:app --reload
```

### Production (Railway, AWS, Heroku)

```bash
# Dockerfile (already optimized)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Environment Setup

```bash
# Set production environment
export DATABASE_URL=postgresql+psycopg://prod-user:prod-pass@prod-host:5432/reconciliation
export OPENAI_API_KEY=sk-prod-key
export DEBUG=False
```

---

## 🐛 Debugging

### Enable SQL Query Logging

```python
# In config.py
SQLALCHEMY_ECHO = True  # Shows all SQL queries
```

### View Generated SQL

```python
# In routes
print(db.session.query(BankTransaction).statement)
```

### Check Matching Scores

```python
# In matching_service.py
logger.info(f"Confidence: {confidence}, Signals: {signals}")
```

---

## 🔐 Security Checklist

- [ ] Row-level security (org_id isolation)
- [ ] SQL injection prevention (ORM prevents this)
- [ ] Rate limiting on endpoints
- [ ] JWT token validation (Clerk integration)
- [ ] HTTPS in production
- [ ] Secrets in environment variables
- [ ] Database connection pooling

---

## 📈 Scaling to Production

**Phase 1: MVP Launch**
- Single PostgreSQL instance
- Single FastAPI instance
- Synchronous processing

**Phase 2: Growth**
- Database replication (read replicas)
- Celery/RQ for async task queue
- Caching layer (Redis)
- Load balancer (Nginx)

**Phase 3: Enterprise**
- Managed DB (AWS RDS, Supabase)
- Kubernetes orchestration
- CDN for static assets
- Analytics pipeline (Segment)

---

## 📚 API Documentation

Auto-generated Swagger UI available at `/docs`

For manual testing:

```bash
# Create organization
curl -X POST http://localhost:8000/api/orgs \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "slug": "acme", "email": "owner@acme.com"}'

# Upload and extract
curl -X POST http://localhost:8000/api/uploads/create-session/org-id \
  -F "file=@bank_statement.pdf" \
  -F "source=bank"
```

---

## 🎯 Next Steps

1. **Integrate Azure AI**: Uncomment in `extraction_service.py`, add API key
2. **Implement OpenAI LLM**: For narration cleaning and column mapping
3. **Add Clerk Auth**: Protect endpoints with JWT validation
4. **Deploy to Railway/AWS**: Use provided Dockerfile
5. **Set up monitoring**: Sentry, DataDog, or similar

---

For questions or issues, check the inline code comments—they're thorough and explain the architecture decisions.
