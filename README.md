# AI Reconciliation SaaS

AI Reconciliation SaaS is a multi-tenant reconciliation platform built with a Next.js frontend, a FastAPI backend, PostgreSQL, Redis, and RQ workers.

The current app supports:

- authenticated tenant-scoped workspaces
- admin/reviewer roles
- workspace-level company branding for reports
- account-first reconciliation workspace and per-account monthly history
- bank statement and cash book upload
- PDF, XLSX, XLS, and CSV ingestion
- Azure Document Intelligence + local PDF + OCR fallback extraction
- AI-assisted column mapping
- transaction standardization and persistence
- queued extraction and reconciliation jobs
- monthly reconciliation history and carry-forward balances
- print-ready reconciliation report preview / PDF export
- audit trail for user actions
- password reset and change flows
- admin dead-letter dashboard for failed jobs

## Current product workflow

### 1. Authentication

Users can:

- register a new workspace as tenant admin
- sign in to an existing workspace
- change their password after signing in
- request a password reset email

If SMTP is not configured in development, the reset flow falls back to showing the raw reset token in the UI.

### 2. Workspace and account setup

Users manage reconciliation from `Settings -> Workspace`.

The workspace now groups saved months under each reconciliation account.

Users can:

- create a new account
- store an optional account number
- choose a reconciliation month / year
- reopen an open month for editing
- start the next month from the same account

Workspace branding such as company name, address, and logo is set once in `Settings` and reused on all reports.

### 3. Upload

Admins upload:

- one bank statement
- one cash book

Supported formats:

- PDF
- XLSX / XLS
- CSV

The upload flow creates reusable upload sessions, supports adding more records into the same open month, and stores source files for retry-safe background processing.

### 4. Extraction and mapping

The backend extracts preview rows and proposes a column mapping for:

- `date`
- `narration`
- `reference`
- either `amount`
- or `debit` + `credit`

The mapping UI supports validation, previews, and deterministic debit/credit-aware handling for both bank statements and cash books.

### 5. Standardization

After mapping is confirmed, rows are standardized into a common transaction shape and persisted as:

- `bank_transactions`
- `book_transactions`

The standardization layer also applies the bank-vs-cash-book polarity rules needed for reconciliation and preserves debit / credit buckets.

### 6. Reconciliation

Once both files are ready, reconciliation runs inside a worksheet-style `Recon Workspace`.

The UI supports:

- four in-place reconciliation quadrants
- exact-match auto-highlighting and checking
- manual checkbox-driven matching
- manual matching
- progressive reconcile passes
- save / continue later
- same-month add-records flow
- monthly session close / reopen
- status feedback

### 7. History and reporting

The app keeps monthly reconciliation sessions grouped under each account with:

- opening balances
- closing balances
- account number
- currency selection (default `GHS / GHC`)
- carry-forward continuity
- printable report preview / PDF export

The report preview includes:

- workspace company name, address, and logo
- account / period details
- reconciliation quadrants and subtotals
- adjusted balances and final difference

### 8. Operations and security

Admins now have access to:

- a dedicated operations dashboard
- failed / dead-lettered job visibility
- job retry controls
- team member management

All authenticated users can view recent audit activity for the workspace.

## Stack

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Zustand
- Lucide React

### Backend

- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis
- RQ
- Pydantic Settings
- JWT auth

### Extraction and document processing

- openpyxl
- pdfplumber
- pdf2image
- pytesseract
- Pillow
- Azure AI Document Intelligence

### Matching

- RapidFuzz

## Architecture highlights

- `frontend` talks to the FastAPI API over HTTP
- `api` persists state in PostgreSQL
- `api` enqueues long-running work in Redis / RQ
- `worker` executes extraction and reconciliation jobs
- uploaded source files are persisted for retry-safe background execution
- Alembic handles schema evolution

## Local development

### Option 1: Docker Compose

This is the easiest way to run the full stack.

```bash
docker compose up --build
```

Services:

- frontend: `http://localhost:3001`
- api: `http://localhost:8000`
- postgres: `localhost:5432`
- redis: `localhost:6379`

Notes:

- the frontend runs on port `3000` inside the container and is exposed as `3001` on the host
- the backend startup script runs Alembic before starting
- the worker starts after database and Redis health checks pass

### Option 2: Production-style image build

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

Pre-deploy verification (migrations + health + queue + smoke):

```bash
./scripts/predeploy_check.sh
```

Optional skip for frontend smoke during backend-only maintenance:

```bash
SKIP_FRONTEND_CHECK=true ./scripts/predeploy_check.sh
```

Backup and restore helpers:

```bash
./scripts/backup_postgres.sh
./scripts/backup_uploads.sh
./scripts/restore_postgres.sh /absolute/path/to/postgres_dump.sql.gz
./scripts/restore_uploads.sh /absolute/path/to/uploads_snapshot.tar.gz
```

Operational runbooks:

- `docs/DEPLOY_RUNBOOK_STAGING_PRODUCTION.md`
- `docs/BACKUP_RESTORE_RUNBOOK.md`
- `docs/SECURITY_RELEASE_GATE.md`

### Option 3: Run manually

Backend:

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
npm install
npm run dev
```

Worker:

```bash
cd backend
rq worker reconciliation -u redis://localhost:6379/0
```

## Environment configuration

Use:

- `.env.example` for development
- `.env.staging.example` for staging
- `.env.production.example` for production
- `backend/.env.example` for backend-only local runs

### Core backend settings

Important variables:

```env
APP_ENV=development
DATABASE_URL=postgresql+psycopg://dev:password@postgres:5432/reconciliation
REDIS_URL=redis://redis:6379/0
UPLOAD_STORAGE_PATH=/app/storage/uploads
FRONTEND_APP_URL=http://localhost:3001
JWT_SECRET_KEY=dev-secret-change-me
JOB_MAX_RETRIES=3
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
```

Production guardrails now enforced by backend config:

- `JWT_SECRET_KEY` must be strong (at least 32 chars) in production
- `DEBUG` must be `False` in production
- `AUTH_BOOTSTRAP_ENABLED` must be `false` in production
- `FRONTEND_APP_URL` and `CORS_ORIGINS` cannot use localhost in production

Route-level governance hardening:

- reconcile mutation endpoints are admin-only
- closed reconciliation months are now enforced as read-only on mutation paths
- tenant-scope checks are enforced across upload/reconcile/job/audit routes

### Optional extraction settings

```env
OPENAI_API_KEY=
AZURE_AI_KEY=
AZURE_AI_ENDPOINT=
```

### Password reset email delivery

The app sends password reset emails through SMTP when configured.

Required variables:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=AI Reconciliation SaaS
SMTP_USE_STARTTLS=true
SMTP_USE_SSL=false
```

Gmail / Google Workspace example:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-google-email@gmail.com
SMTP_PASSWORD=your-google-app-password
SMTP_FROM_EMAIL=your-google-email@gmail.com
SMTP_FROM_NAME=AI Reconciliation SaaS
SMTP_USE_STARTTLS=true
SMTP_USE_SSL=false
```

Notes for Gmail:

- use a Google App Password, not your normal Gmail password
- `SMTP_PORT=587` with `SMTP_USE_STARTTLS=true` is the correct pairing
- `SMTP_USERNAME` and `SMTP_FROM_EMAIL` should usually be the same mailbox

Behavior:

- if SMTP is configured, users receive a reset email with a direct link back to the app
- if SMTP is not configured and `APP_ENV=development`, the raw reset token is returned in the auth UI for local testing
- if SMTP fails in production, the API returns an error instead of silently pretending delivery worked

The reset email link points to:

```env
FRONTEND_APP_URL
```

So for local Docker development this should usually stay:

```env
FRONTEND_APP_URL=http://localhost:3001
```

## Auth and tenancy

- every authenticated user belongs to exactly one organization
- tenant access is enforced server-side
- admins can upload, run jobs, create users, close/reopen sessions, and retry jobs
- reviewers can inspect workspaces, approve/reject matches, and download reports

## Background jobs

Extraction and reconciliation are persisted as `processing_jobs`.

Jobs support:

- queued
- running
- completed
- failed
- dead-lettered

When a job fails:

- it is retried automatically up to `JOB_MAX_RETRIES`
- once retries are exhausted, it moves to `dead_lettered`
- admins can manually retry it from the operations dashboard

## Audit trail

The app stores audit events for actions such as:

- registration and login
- user creation
- password changes
- password reset requests and completion
- upload session creation and reuse
- job enqueue and retry
- mapping confirmation
- match approval and rejection
- month close and reopen
- report downloads

## Project structure

```text
.
├── backend/
│   ├── alembic/
│   ├── app/
│   │   ├── database/
│   │   ├── dependencies/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── config.py
│   │   └── main.py
│   ├── scripts/
│   ├── Dockerfile
│   └── Dockerfile.dev
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── store/
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile.frontend
├── Dockerfile.frontend.dev
└── README.md
```

## Verification commands

Useful checks:

```bash
python3 -m compileall backend/app backend/alembic
npm run build
docker compose config
```

## Status

This is no longer just a static MVP shell. It now includes real auth, tenancy, queueing, reporting, auditability, and operational recovery flows, while still leaving room for deeper production hardening like SSO, external object storage, alerts, and richer reporting.
