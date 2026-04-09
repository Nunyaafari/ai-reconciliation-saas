# Reconciliation Workflow And Production Plan

## Core Concept

This product is not a generic transaction matcher. It is a worksheet-style bank reconciliation system built around one account and one reconciliation period at a time.

Each reconciliation is scoped by:

- Organization
- Account name
- Account number (optional but useful for grouping)
- Month
- Year

The user should be able to continue the same account month after month, while carrying forward only the outstanding items and the closing balances from the prior month.

Workspace branding is not account-specific. Company name, address, and logo should be configured once at the workspace level and reused across reconciliation reports.

## Canonical Upload Shape

Both the bank statement and the cash book should be uploaded in the same accounting shape:

- `Date`
- `Reference`
- `Narration`
- `Debit`
- `Credit`

For each row:

- Either `Debit` has a value and `Credit` is blank
- Or `Credit` has a value and `Debit` is blank

Single signed amount columns are not part of the preferred workflow.

## Four Buckets

After upload and mapping, every transaction belongs to one of four buckets:

1. `Bank Credits`
2. `Bank Debits`
3. `Cash Book Debits`
4. `Cash Book Credits`

These four buckets are the foundation of the workflow and should remain visible to the user as the primary worksheet surface.

## Upload And Preview Workflow

The intended user journey is:

1. Go to `Settings -> Workspace`
2. Choose `New Account` or select an existing reconciliation account
3. Select `Month` and `Year`
4. Optionally enter:
   - `Opening Cash Book Balance`
   - `Opening Bank Balance`
   - `Closing Cash Book Balance`
   - `Closing Bank Balance`
5. Upload bank statement
6. Review bank upload preview split into:
   - `Bank Credits`
   - `Bank Debits`
   - Each section shows all rows and subtotal
7. Upload cash book
8. Review cash book upload preview split into:
   - `Cash Book Debits`
   - `Cash Book Credits`
   - Each section shows all rows and subtotal
9. Move to `Recon Workspace`

The upload previews are not just diagnostics. They are the first accounting checkpoint to prove that mapping and classification are correct.

## Recon Workspace Layout

The `Recon Workspace` worksheet should present the four buckets in the working reconciliation layout:

- Top lane:
  - `Bank Credits` beside `Cash Book Debits`
- Bottom lane:
  - `Cash Book Credits` beside `Bank Debits`

This is the correct accounting pairing for the reconciliation exercise.

The worksheet should also show:

- Cash book opening and closing balances at the top
- Bank statement opening and closing balances at the top
- Subtotals for each side of each lane
- Difference per lane
- Adjusted cash book balance beneath the left quadrants
- Adjusted bank balance beneath the right quadrants
- Final difference

Adjusted balance formulas:

- `Adjusted Cash Book Balance = Closing Cash Book Balance + Bank Credit Subtotal + Cash Book Credit Subtotal`
- `Adjusted Bank Balance = Closing Bank Balance + Cash Book Debit Subtotal + Bank Debit Subtotal`

## Reconcile Behavior

When the user clicks `Reconcile`, the system should operate inside those same quadrants, not in a separate review screen.

Expected behavior:

1. The system finds suggested matches
2. Safe exact matches are automatically highlighted and checked
3. Lower-confidence matches are highlighted differently
4. The user confirms which checked matches should be removed
5. The subtotal of checked rows on the left and right side of a lane should match when the selection is correct

The quadrants themselves are the reconciliation workspace.

## After Recon Meaning

After the user removes the checked matched rows:

- Entire matched rows should no longer be visible in the quadrants
- The same quadrants now show only outstanding items
- Remaining rows form the carryforward basis
- The report should be generated from these remaining rows

Matched rows still exist historically and in audit trails, but they should not remain visible in the outstanding worksheet.

## Month Close And Carry Forward

At month end, the user should be able to:

1. Save the current position
2. Lock the period from further edits
3. Carry forward:
   - Outstanding rows
   - Closing balances
4. Open the next month for the same account
5. Add fresh uploads for the new month

That next month should start with the carried-forward outstanding items already in the correct quadrants.

### Current Status

The first pass of month close and carryforward is now implemented in the codebase:

- Closing a session creates or updates the next month for the same account
- Unresolved rows are cloned into that next month as carryforward rows
- Closing balances are carried into the next month session
- The worksheet loader can now hydrate a month from both fresh uploads and carryforward rows
- Settings now own workspace branding and audit visibility
- Workspace history is being restructured around account-first navigation

What still needs tightening:

- stronger end-to-end testing of the close-month path
- clearer UX messaging around "fresh upload" rows vs `Carryforward` rows
- stricter protection against editing already-closed months from legacy paths
- removal of the last flat-history / legacy navigation paths

## Old Ezirecon Math To Preserve

The legacy model uses four subtotals:

- `bank_debit_subtotal`
- `bank_credit_subtotal`
- `book_debit_subtotal`
- `book_credit_subtotal`

Working lane differences:

- `lane_one_difference = book_credit_subtotal - bank_debit_subtotal`
- `lane_two_difference = bank_credit_subtotal - book_debit_subtotal`

Adjusted balances:

- `adjusted_cash = book_closing_balance + bank_credit_subtotal + book_credit_subtotal`
- `adjusted_bank = bank_closing_balance + book_debit_subtotal + bank_debit_subtotal`

Overall statement difference:

- `difference = adjusted_cash - adjusted_bank`

These formulas are part of the accounting contract of the product and should remain stable.

## Current Product Direction

The current implementation is moving toward the right model:

- Account + period scoped reconciliation exists
- Uploads are being classified into debit/credit buckets
- Bank and cash book parsing now use more deterministic spreadsheet logic
- The worksheet is moving toward in-place reconciliation inside the same quadrants
- Exact matches can be auto-staged

The product still needs tightening so every screen consistently follows the worksheet mental model.

## Suggested Next Steps To Production Grade

### 1. Finish The In-Place Quadrant Workflow

- Keep reconciliation fully inside the four quadrants
- Remove remaining duplicate or legacy match-review UI
- Make lane subtotal and checked subtotal behavior rock solid
- Ensure matched rows disappear immediately after approval

### 2. Harden Upload Classification

- Keep deterministic bank and cash book mapping for `Date / Reference / Narration / Debit / Credit`
- Avoid over-relying on sparse-column heuristics
- Validate row counts and debit/credit totals before committing uploads
- Add clear warnings when a file structure is suspicious

### 3. Make Carryforward A First-Class Feature

- Carry outstanding rows into the next month automatically
- Preserve the originating month for carried rows
- Let users distinguish fresh-month rows from carryforward rows
- Prevent accidental editing of closed months

### 4. Improve Match Trust And Control

- Separate exact, high-confidence, and discretionary suggestions visually
- Add lane-level approve/remove flows that mirror the workbook
- Add stronger duplicate-prevention rules
- Support one-to-one first, then controlled one-to-many or many-to-one if truly needed

### 5. Formalize Auditability

- Record who uploaded, mapped, reconciled, removed, restored, closed, and carried forward
- Keep the audit trail in `Settings`, not on the worksheet screen
- Make in-place row removals visible in the audit trail
- Include report generation and month-close events

### 6. Add Regression Tests Around The Accounting Contract

- Spreadsheet parsing tests for bank and cash book samples
- Mapping tests for title rows plus real header rows
- Standardization tests for sparse debit/credit columns
- Matching tests for exact and discretionary cases
- Reconciliation statement tests for subtotal and adjusted-balance formulas
- Carryforward tests across month transitions

### 7. Strengthen Operational Reliability

- Keep queue-backed extraction and matching
- Add better retry and dead-letter tooling
- Make file/session reuse deterministic and visible
- Add metrics around parse time, mapping quality, and reconciliation outcomes

### 8. Production Infrastructure

- Stable build images for `api`, `worker`, and `frontend`
- Strict environment separation for dev, staging, and production
- Migration discipline through Alembic only
- Backup and restore procedures for database and uploaded files
- Error tracking, alerting, and structured logs

Current execution checklist (April 2026):

- [x] Enforce backend production guardrails at startup:
  - reject weak `JWT_SECRET_KEY`
  - reject `DEBUG=true` in production
  - reject localhost `FRONTEND_APP_URL` / `CORS_ORIGINS` in production
  - reject `AUTH_BOOTSTRAP_ENABLED=true` in production
- [ ] Add explicit staging and production deploy runbooks with cutover/rollback steps
- [x] Add automated pre-deploy check:
  - `alembic upgrade head` must succeed
  - API `/health` and worker queue checks must pass
  - static asset build and startup smoke checks must pass
- [ ] Add backup/restore scripts and schedule:
  - postgres dump rotation policy
  - uploaded file storage snapshot policy
  - quarterly restore drill
- [ ] Add structured log shipping and central error tracking
- [ ] Add container resource defaults for heavy reconciliations (CPU/memory limits and timeouts)

### 9. Security And Governance

- Keep tenant scoping strict
- Maintain role-based permissions
- Add password reset email hardening and account security checks
- Review exported reports and audit access paths

Current execution checklist (April 2026):

- [x] Tenant-scope verification pass on every route:
  - no cross-tenant reads/writes by ID
  - no session leaks across organizations
- [x] Role-based permission pass:
  - admin-only mutate operations
  - reviewer read-only enforcement on upload/mapping/reconcile/close/reset flows
- [ ] Password reset hardening:
  - token entropy and expiry checks
  - invalidate previous tokens on issue
  - rate-limit reset and login attempts
- [ ] Session and auth hardening:
  - audit failed auth attempts
  - enforce secure defaults for JWT secret and expiration
  - tighten CORS and frontend origin policy
- [ ] Report and audit governance:
  - verify only authorized users can access exports
  - ensure closed-month data remains immutable except explicit reopen path
- [ ] Security release gate:
  - add a mandatory pre-production security checklist sign-off

## Practical Build Order

Recommended sequence from here:

1. Finish the account-first workspace flow end to end
2. Finish the in-place quadrant reconciliation UX
3. Complete month close and carryforward hardening
4. Lock down upload validation and accounting regression tests
5. Clean out legacy duplicate UI paths
6. Add operational metrics and alerts
7. Run a production-readiness pass across security, backups, and deployment

## Guiding Principle

The product should always feel like a bank reconciliation worksheet first, and an AI-assisted matcher second.

AI should help the accountant:

- classify
- suggest
- highlight
- accelerate review

But the accounting structure, visual layout, subtotals, and carryforward logic should remain explicit, stable, and understandable at every step.
