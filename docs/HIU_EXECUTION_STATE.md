# HIU YHCT 4.0 — Execution State

Updated: 2026-09-11
Branch: `hiu-acc-phase1-20260911`
Base: `main` @ `350e4ad50e20cbfac33bd17f8ff04daa0350c9f6`
Production project: `yhct-hiu-final4-stage`
Production deployment baseline: `dpl_7mQiYgkdRGACvzBmzw7Vbe8mKysn` — READY
Supabase baseline: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 1 — ACC / Admin Control Center

## PHASE 0 completed

- Repository, main branch, package/runtime and current production deployment identified.
- Vite + React 18 + TypeScript 5.7 baseline confirmed.
- Production Vercel deployment matches current main commit.
- Supabase project used by `authService.ts` identified and healthy.
- Existing AI source of truth reviewed: `docs/AI_CANONICAL_ARCHITECTURE_2026-09-11.md`.
- Existing quiz approval/integrity pipeline and AI role contract work are considered stable baseline.

## DO_NOT_BREAK

- Authentication/session restore and current Supabase ACL/RLS behavior.
- Existing `SystemRole` hierarchy and production role RPC contracts.
- Approved quiz bank, admin review gate, daily practice and free-practice behavior.
- AI canonical role boundaries: App Assistant / Research / module capability.
- HIU Y Quan game state, score/progression and existing game contract tests.
- Current production aliases and Vercel Git integration.

## Batch in progress

Goal: reduce ACC vertical overload without changing database schema or API contracts.

Planned files:
- `src/components/admin/SystemAdminCenter.tsx`
- `src/App.tsx`
- optional scoped ACC CSS only if needed

Acceptance criteria:
- ACC exposes compact functional sections instead of rendering every operations block at once.
- AI status remains centralized under A.I Center.
- Quiz document workflow remains reachable and unchanged functionally.
- Theme/ops utilities are secondary, not dominant content.
- No schema/API/role enum changes in this batch.

## Tests required for this batch

- Web CI / TypeScript.
- Existing admin/account audit contracts.
- Existing AI contracts.
- Existing quiz pipeline/integrity contracts.
- Vite production build.
- Preview smoke before merge.

## Remaining high-level phases

2. Document → Quiz pipeline hardening / progress / retry UX.
3. Learning Hub restructuring.
4. Home/news simplification and daily suggestion/weather header.
5. Notification read-state correctness.
6. Profile learning achievements/game title.
7. Responsive UI/UX cleanup.
8. Version cleanup by reference/dependency evidence only.
9. Top-5 AI health issues by Impact × Frequency × Risk.
10. ACC AI/System Health safe-fix workflow.
11. Performance bottlenecks.
12. Final multi-viewport QA and production verification.

## Next step

Complete the PHASE 1 bounded ACC batch, run targeted CI, then update this file before moving to PHASE 2.
