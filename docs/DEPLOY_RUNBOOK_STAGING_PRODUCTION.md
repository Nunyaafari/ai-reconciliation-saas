# Deploy Runbook (Staging -> Production)

## Goal

Ship the same image set safely from staging to production with explicit verification and rollback.

## Prerequisites

- Docker + Compose available on target host
- `.env` configured for the target environment
- Database credentials valid
- `JWT_SECRET_KEY` strong (32+ chars)
- `AUTH_BOOTSTRAP_ENABLED=false` in production

## 1) Build And Verify (CI or Release Host)

```bash
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
./scripts/predeploy_check.sh
```

Expected: predeploy check exits `0`.

## 2) Staging Deploy

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.staging up -d --build
```

Verify:

```bash
docker compose ps
curl -fsS http://127.0.0.1:8000/health
```

Smoke flow:

- Sign in
- Upload sample bank + cashbook
- Run one reconcile pass
- Open report preview

## 3) Production Cutover

Take backup before cutover:

```bash
./scripts/backup_postgres.sh
./scripts/backup_uploads.sh
```

Deploy:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Post-deploy checks:

```bash
./scripts/predeploy_check.sh
docker compose logs --tail=120 api
docker compose logs --tail=120 worker
```

## 4) Rollback

If health checks fail or critical paths break:

1. Re-deploy previous known-good image tags
2. Restore DB backup if schema/data corruption occurred
3. Restore upload snapshot when required

DB restore helper:

```bash
./scripts/restore_postgres.sh /absolute/path/to/backup.sql.gz
```

Uploads restore helper:

```bash
./scripts/restore_uploads.sh /absolute/path/to/uploads_backup.tar.gz
```

## 5) Release Notes Checklist

- Migration ID(s) applied
- Any env var changes
- Known limitations
- Rollback image tags and backup file names
