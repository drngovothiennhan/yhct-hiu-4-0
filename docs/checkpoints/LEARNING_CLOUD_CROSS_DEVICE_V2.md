# CHECKPOINT — LEARNING-CLOUD-CROSS-DEVICE-V2

Date: 2026-09-24
Base: `e644c7d5c26df7f2248bf876aa877b96110969af`

## Goal
Persist authenticated Study OS learning state on Supabase and restore it automatically after signing in on another device.

## Included
- Authenticated GET `/functions/v1/learning-sync?snapshot=1` returns the latest member-owned snapshot after AES-GCM decrypt + gzip decompress + SHA-256 checksum validation.
- Existing stats-only GET stays backward compatible for hiutmc.com.
- Client restores journey, adaptive review cards and 14-day local daily-history before enabling upload listeners.
- Empty/new-device local state yields to the server snapshot; meaningful newer local state is preserved and uploaded.
- Server rejects stale client snapshots using `client_updated_at`, preventing an older device from overwriting newer progress.
- Snapshot remains encrypted at rest with member-derived AES-GCM key material; authorization remains approved-member only.

## Frozen
No UI redesign, quiz content, account permissions, or public access rules are changed.
