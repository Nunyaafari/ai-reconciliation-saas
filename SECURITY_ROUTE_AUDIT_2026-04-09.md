# Security Route Audit (2026-04-09)

## Scope

Reviewed route-level tenant scoping and RBAC across:

- `backend/app/routes/reconciliation.py`
- `backend/app/routes/uploads.py`
- `backend/app/routes/jobs.py`
- `backend/app/routes/auth.py`
- `backend/app/routes/organizations.py`
- `backend/app/routes/audit.py`

## Findings

### 1) Reconcile mutation RBAC too permissive

- `POST /api/reconciliation/match/{match_id}/approve`
- `DELETE /api/reconciliation/match/{match_id}`

These mutation routes previously allowed any authenticated user (`get_current_user`), including reviewer role users.

### 2) Closed-month immutability not fully enforced on all mutation paths

Mutation operations could still affect transactions tied to closed reconciliation months via:

- manual match creation
- single/bulk match approval
- match rejection
- remove/restore outstanding transactions
- reset session (without a closed-month guard)

## Remediations Implemented

### RBAC tightening

Changed these routes to admin-only:

- `POST /api/reconciliation/match/{match_id}/approve`
- `DELETE /api/reconciliation/match/{match_id}`

### Closed-month mutation guard

Added transaction-scoped closed-month checks in reconciliation routes. If any target transaction belongs to a closed `reconciliation_session`, the API now returns a clear 400 error and blocks the write:

- manual match creation
- single/bulk approve
- reject
- transaction remove/restore

Also blocked session reset when month status is closed.

## Current Tenant-Scope Status

Tenant scoping is enforced through:

- `ensure_org_access(...)` for org-param routes
- org-filtered object fetch helpers (`get_upload_session_or_404`, `get_reconciliation_session_or_404`, `get_match_group_or_404`)
- org filters on direct transaction and job queries

No route-level cross-tenant IDOR gap was identified in this pass.

## Remaining Security Work (Next)

- Add auth/login and password-reset request rate limiting.
- Add audit log entries for failed login attempts.
- Add automated security checks in CI (route RBAC/tenant regression tests).
- Add explicit security sign-off gate before production deploy.
