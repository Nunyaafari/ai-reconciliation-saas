# Backup & Restore Runbook

## Backup Frequency

- Postgres logical dump: daily
- Upload storage snapshot: daily
- Retention target: 30 days local + offsite copy
- Restore drill: quarterly

## Backup Commands

```bash
./scripts/backup_postgres.sh
./scripts/backup_uploads.sh
```

Both scripts write to `./backups/` by default.

## Restore Commands

```bash
./scripts/restore_postgres.sh /absolute/path/to/db_dump.sql.gz
./scripts/restore_uploads.sh /absolute/path/to/uploads_snapshot.tar.gz
```

## Quarterly Restore Drill

1. Start isolated environment (staging)
2. Restore DB dump + uploads snapshot
3. Verify:
   - account list loads
   - open month can resume
   - report preview renders
4. Record drill date + outcome in ops notes

## Notes

- DB restore script drops and recreates `public` schema.
- Run restores only against the intended environment.
