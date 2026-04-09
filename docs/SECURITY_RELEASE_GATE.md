# Security Release Gate

Use this checklist before every production release.

## Auth & Session

- [ ] `JWT_SECRET_KEY` is rotated and strong (32+ chars)
- [ ] `AUTH_BOOTSTRAP_ENABLED=false`
- [ ] Login and password reset rate limits verified
- [ ] Failed login events visible in audit logs

## Tenant & Permissions

- [ ] No cross-tenant access by ID-only route calls
- [ ] Reviewer users cannot mutate upload/reconcile/close/reset flows
- [ ] Closed-month session blocks are enforced for all write paths

## Data Protection

- [ ] Production CORS allows only approved frontend origins
- [ ] Password reset tokens expire and previous tokens are invalidated on new issue
- [ ] Report/export endpoints checked with non-authorized user token

## Operational Safety

- [ ] Backup scripts executed successfully
- [ ] Latest restore drill date recorded (<= 90 days)
- [ ] Structured logs available for API and worker incidents

## Sign-Off

- Release version:
- Environment:
- Approved by:
- Date:
