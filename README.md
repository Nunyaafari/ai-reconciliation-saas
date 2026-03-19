# AI Reconciliation SaaS

AI Reconciliation SaaS is a full-stack reconciliation MVP built with a Next.js frontend, a FastAPI backend, and PostgreSQL. The current codebase is no longer just a UI prototype: it supports organization bootstrap, file upload sessions, extraction of bank and cash book files, AI-assisted column mapping, transaction standardization, database persistence, and a review workflow for reconciliation matches.

## What the app currently does

The app implements a connected end-to-end flow:

1. **Bootstrap an organization** for local/dev usage.
2. **Upload two files**: a bank statement and a cash book.
3. **Extract data** from PDF, XLSX, or CSV files.
4. **Guess the column mapping** and let the user verify or correct it.
5. **Standardize transactions** into a common schema and persist them.
6. **Run reconciliation** to generate pending matches and unmatched suggestions.
7. **Approve or reject matches** from the reconciliation workspace.

## Current product workflow

### 1) Upload
The frontend upload step accepts **PDF, XLSX, XLS, and CSV** files up to **10 MB** and tracks separate upload sessions for `bank` and `book` sources.

### 2) Extraction and mapping
After upload, the app moves into a mapping flow where it:

- extracts preview rows,
- detects column headers,
- proposes a mapping for `date`, `narration`, `reference`, and either `amount` or `debit`/`credit`,
- shows extraction confidence and method,
- lets the user confirm or override the mapping.

### 3) Standardization
Once the user confirms the mapping, the backend standardizes rows into a common transaction shape:

- `trans_date`
- `narration`
- `reference`
- `amount`

The standardized transactions are then stored in PostgreSQL as either bank or book transactions.

### 4) Reconciliation workspace
When both files are mapped, the reconciliation workspace starts the backend matching process and shows:

- progress across uploaded transactions,
- pending / approved / rejected match counts,
- unmatched bank transactions,
- AI-generated suggestions for candidate book matches,
- match review, manual match creation, bulk approval, and rejection.

## Architecture

### Frontend
- **Framework:** Next.js 15
- **Language:** TypeScript
- **UI:** React 19 + Tailwind CSS
- **State management:** Zustand
- **Icons:** Lucide React

### Backend
- **Framework:** FastAPI
- **ORM:** SQLAlchemy
- **Validation/config:** Pydantic + pydantic-settings
- **Database:** PostgreSQL

### Matching and ingestion utilities
- **Fuzzy matching:** RapidFuzz
- **Excel parsing:** openpyxl
- **PDF parsing:** pdfplumber
- **OCR fallback:** pdf2image + pytesseract
- **Cloud PDF extraction (optional):** Azure AI Document Intelligence
- **OpenAI SDK:** present in dependencies for future intelligence extensions

## Extraction behavior

The extraction service uses different strategies depending on file type:

- **CSV:** parsed locally with Python's `csv` module
- **XLSX:** parsed with `openpyxl`
- **PDF:**
  - first tries **Azure AI Document Intelligence** when properly configured,
  - otherwise falls back to **local pdfplumber-based extraction**,
  - and finally to **OCR** when needed and available

The backend also returns the extraction method and confidence so the UI can warn the user when results need closer verification.

## Matching behavior

The matching engine currently supports:

- **deterministic 1:1 matching** for strong exact matches,
- **probabilistic 1:1 matching** using a weighted confidence score,
- **1:N combination matching** for split or consolidated entries.

Current signal weights are:

- **Value:** 50%
- **Date:** 20%
- **Reference:** 20%
- **Narration:** 10%

Narration similarity is computed with RapidFuzz.

## Tech stack summary

### Frontend dependencies
- next
- react
- react-dom
- typescript
- tailwindcss
- zustand
- lucide-react
- clsx

### Backend dependencies
- fastapi
- uvicorn
- sqlalchemy
- psycopg
- alembic
- python-multipart
- polars
- rapidfuzz
- openai
- azure-ai-documentintelligence
- openpyxl
- pdfplumber
- pdf2image
- pytesseract
- pillow

## Project structure

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── routes/
│   │   │   ├── organizations.py
│   │   │   ├── reconciliation.py
│   │   │   └── uploads.py
│   │   ├── services/
│   │   │   ├── extraction_service.py
│   │   │   ├── matching_service.py
│   │   │   └── standardization_service.py
│   │   └── database/
│   ├── Dockerfile
│   └── requirements.txt
├── src/
│   ├── app/
│   │   └── page.tsx
│   ├── components/
│   │   ├── UploadStepConnected.tsx
│   │   ├── MappingStepConnected.tsx
│   │   ├── ReconciliationStepConnected.tsx
│   │   └── MatchReviewPanel.tsx
│   ├── lib/
│   │   └── api.ts
│   └── store/
│       └── reconciliation-api.ts
├── Dockerfile.frontend
├── docker-compose.yml
└── package.json
```

## Running locally

### Option 1: Docker Compose
This is the easiest way to run the full stack.

```bash
docker-compose up --build
```

This starts:

- **PostgreSQL** on `localhost:5432`
- **FastAPI backend** on `localhost:8000`
- **Next.js frontend** on `localhost:3001`

Notes:
- The frontend container runs on port `3000` internally but is mapped to **host port `3001`**.
- The backend container waits for PostgreSQL health before starting.
- The backend startup command installs requirements and runs Uvicorn with reload.

### Option 2: Run services manually

#### Start PostgreSQL
Run a local PostgreSQL instance and create a database named `reconciliation`.

#### Start the backend
From `backend/`:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Start the frontend
From the repo root:

```bash
npm install
npm run dev
```

By default, Next.js will run on `localhost:3000` unless you override the port.

## Environment configuration

### Backend `.env`
The backend reads configuration from environment variables and also supports a local `.env` file.

Example:

```env
DATABASE_URL=postgresql+psycopg://dev:password@localhost:5432/reconciliation
DEBUG=True
OPENAI_API_KEY=
AZURE_AI_KEY=
AZURE_AI_ENDPOINT=
CLERK_SECRET_KEY=
```

Useful defaults already exist in code and Docker Compose, but real Azure credentials are required if you want cloud PDF extraction.

### Frontend `.env.local`
If you want to point the frontend to a non-default API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If this variable is not set, the frontend falls back to `http://localhost:8000`.

## API surface

### Organization routes
- `POST /api/orgs` — create an organization
- `POST /api/orgs/bootstrap` — fetch or create a default org for local/dev

### Upload routes
- `POST /api/uploads/create-session/{org_id}?source=bank|book`
- `POST /api/uploads/extract/{session_id}`
- `POST /api/uploads/confirm-mapping/{session_id}`
- `GET /api/uploads/session/{session_id}`
- `GET /api/uploads/transactions/{session_id}/bank`
- `GET /api/uploads/transactions/{session_id}/book`

### Reconciliation routes
- `POST /api/reconciliation/start/{org_id}`
- `POST /api/reconciliation/match/{org_id}`
- `POST /api/reconciliation/match/{match_id}/approve`
- `DELETE /api/reconciliation/match/{match_id}`
- `GET /api/reconciliation/status/{org_id}/{bank_session_id}/{book_session_id}`

### Health route
- `GET /health`

## Frontend state model

The Zustand store in `src/store/reconciliation-api.ts` manages:

- current step (`upload`, `mapping`, `reconciliation`, `complete`),
- bank and book upload session IDs,
- uploaded files,
- extracted and standardized transactions,
- match groups,
- unmatched suggestions,
- activity log,
- loading, errors, and progress.

## Important implementation details

- Tables are created automatically at backend startup via SQLAlchemy metadata creation.
- The app persists uploaded-session metadata, transactions, match groups, and ingestion fingerprints in PostgreSQL.
- Mapping confirmation can save a learned fingerprint for future uploads.
- Bulk approval and rejection are supported from the frontend.
- The homepage performs a backend health check against `http://localhost:8000/health` during load.

## Known limitations / MVP notes

This repository is beyond the original mock prototype, but it is still an MVP.

Current limitations include:

- no production authentication flow yet,
- no background jobs or async worker pipeline,
- local/dev bootstrap organization flow instead of a full tenant onboarding system,
- limited reporting/export flow,
- heuristic column guessing rather than a full LLM-driven mapping system,
- fingerprinting logic is still simplistic,
- some workflow polish remains around completion and production deployment.

## What changed relative to the old README

The previous README described this repo as a mostly mock, UI-only prototype. That is no longer accurate.

This updated README reflects that the current codebase includes:

- a real FastAPI backend,
- a PostgreSQL database,
- connected frontend API calls,
- real upload and extraction endpoints,
- transaction standardization,
- persisted reconciliation match groups,
- bulk review actions,
- Docker-based local startup for the whole stack.

## License

Built for demonstration and MVP development purposes.
