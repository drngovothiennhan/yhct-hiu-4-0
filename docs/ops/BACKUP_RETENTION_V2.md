# YHCT HIU 4.0 — Backup & Retention V2

Status: active on Supabase production `gzmpnsrwqjpsbklyflqr` as of 2026-09-08 UTC.

## Primary data store

Supabase PostgreSQL is the system of record for application data. Supabase Auth is the identity system. Supabase Storage is the media object store. Vercel and GitHub are not authoritative stores for member/application data.

## Snapshots

- Daily operational snapshot: `private.daily_managed_snapshot()` via cron `yhct-managed-snapshot-daily` (`13 18 * * *`).
- Daily retention: 30 days for `daily_full_v2` snapshots.
- Monthly operational snapshot: `private.monthly_managed_snapshot()` via cron `yhct-managed-snapshot-monthly` (`23 18 1 * *`).
- Monthly retention: 12 months for `monthly_full_v2` snapshots.
- Manual snapshots use `manual_full_v2` and are not deleted by the daily/monthly snapshot retention functions.
- Every operational snapshot stores SHA-256 checksum and per-table row counts.

Snapshot V2 includes mutable application tables for members, academic/social content, DRL, notifications, research, schedules, scores, system logs/incidents and TCM news. It also includes a non-secret Auth user manifest and Storage object metadata manifest.

Explicitly excluded from snapshot payload: password hashes, refresh tokens, OTP/recovery secrets, service-role secrets and Storage object bytes.

## Operational retention

`private.daily_retention_maintenance()` runs via cron `yhct-retention-daily` (`43 18 * * *`):

- terminal notification outbox (`sent/failed/dead/cancelled`): 30 days
- read notifications: 365 days
- unpinned TCM news: 365 days
- expired login throttle rows: 7 days
- system audit logs: 730 days

DRL, membership, academic records, schedules/research and unread notifications are not subject to these purge rules.

## Off-site transfer staging

`public.system_backup_exports` is a short-lived RLS-locked staging table. Direct `public`, `anon` and `authenticated` access is revoked. A prepared export expires after 20 minutes.

`offsite-backup-export-v1` is intended only for controlled off-site transfer and requires both:

1. the short-lived export UUID; and
2. the `X-YHCT-Backup-Key` internal credential, validated against `offsite_backup_export_secret` stored in Supabase Vault.

The Vault secret is never returned by the frontend, never embedded in the export URL and must not be committed to source control. Invalid or missing credentials deliberately receive a generic `404 Not Found` response so the endpoint does not confirm whether an export UUID exists.

Google Drive folder `HIU YHCT 4.0/01_BACKUP_SYSTEM` currently contains backup/release artifacts and the V2 backup manifest. Full automated payload mirroring requires a server-side Google Drive OAuth/service-account credential with write permission; the existing `GOOGLE_DRIVE_API_KEY` integration is read-only and cannot upload files.

No server-side Google Drive write credential is committed to this repository. Secrets must never be committed to source control.
