# HIU YHCT 4.0 — Execution State

Updated: 2026-09-11
Branch: `hiu-learning-manager-phase1-20260911`
Base: `main` @ `fa545002ca7d52c27673014aedf6bcb06445a44e`
Pull request: `#71`
Production project: `yhct-hiu-final4-stage`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 1 — ACC / Admin Control Center

## PHASE 0 — DONE

- Repository, `main`, Vite/React/TypeScript runtime, Vercel production, Supabase, auth, role hierarchy, AI integrations and major UI modules were baselined.
- Stable auth/RLS, role contracts, approved quiz bank, AI role boundaries, HIU Y Quan game/score state and production deployment flow are `DO_NOT_BREAK`.

## PHASE 1 — bounded batch 1 — DONE / PRODUCTION VERIFIED

Goal: reduce ACC vertical overload without changing database or API contracts.

Changed:
- `src/components/admin/SystemAdminCenter.tsx`
- `src/components/admin/acc-system-center.css`
- `docs/HIU_EXECUTION_STATE.md`

Result:
- ACC grouped into `Tổng quan`, `Học tập`, `A.I Center`, `Nội dung`, `Vận hành`.
- Only the selected operational section renders.
- Quiz import and A.I Operations remain their canonical surfaces.
- PR `#70` merged to `main` at `fa545002ca7d52c27673014aedf6bcb06445a44e`.
- Main CI, TypeScript/Vite build, Chrome responsive smoke and viewport matrix passed.
- Fresh Vercel production deployment from `fa545002...` reached READY and live production smoke passed.

## PHASE 1 — bounded batch 2A — CODE QA DONE / MERGE PENDING

Goal: provide `Ban Quản lý Học tập` with narrowly scoped learning-content permissions without creating a new system role.

Architecture decision:
- `app_role` remains exactly `guest/member/mod/super_mod/leader/admin`.
- `Ban Quản lý Học tập` is a scoped capability based on exact `position_title`, not a `SystemRole`.
- Capability requires approved membership, login enabled and no data conflict.
- Capability is restricted to document-to-quiz workspace, quiz ingestion and quiz review.
- Research Drive administration, ACC system operations, user management and A.I diagnostics remain on existing Admin gates.

Changed files:
- `api/_lib/member-access.js`
- `api/_lib/quiz-workspace.js`
- `api/ai/drive-rag.js`
- `ops/sql/20260911_learning_content_manager_capability.sql`
- `scripts/v22-quiz-import-check.mjs`
- `docs/HIU_EXECUTION_STATE.md`

Database:
- Production migration `learning_content_manager_capability` applied successfully.
- `private.is_learning_content_manager()` added with fail-closed membership checks.
- `current_member_access_v1()` extended backward-compatibly with `positionTitle` and `learningContentManager`.
- Quiz workspace/ingest/review RPCs accept the scoped capability; existing admin/mod review access remains compatible where intended.
- `app_role` enum rechecked after migration and remains unchanged.
- Supabase security/performance advisor categories showed no new category introduced by this migration; existing baseline findings remain outside this bounded batch.

Verification:
- PR `#71` head before this checkpoint: `594588f4869ff756360f42c9d307a3208cd52440`.
- CI `#583`: failed only because the old authorization regression mocked the prior admin-only contract.
- Regression test was corrected to model the scoped capability without weakening runtime authorization.
- CI `#584` attempt 1: quiz authorization 8/8 PASS, TypeScript/Vite build PASS; Chrome process failed to expose CDP port 9222 within 16 seconds before any UI assertion.
- CI `#584` attempt 2 on the same commit: all contracts PASS, quiz authorization 8/8 PASS, production build PASS, real Chrome mobile/desktop smoke PASS, adaptive viewport matrix PASS, artifact gate PASS.
- The first Chrome failure is therefore classified as transient runner/browser startup, not an application regression. No production workaround was added.

## Remaining PHASE 1 work

1. Merge PR `#71` only after this checkpoint commit passes CI.
2. Verify main CI and a fresh Vercel production deployment/live smoke.
3. Next bounded batch: Admin appointment UI for `Ban Quản lý Học tập` plus a restricted learning-content entry surface. Do not expose ACC system operations to this capability.

## Remaining high-level phases

2. Document → Quiz pipeline hardening: state/progress/retry/idempotency/large-document batching.
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

Wait for CI on this checkpoint-only documentation commit. If green, squash-merge PR `#71`, verify `main` CI, Vercel READY deployment and live production smoke, then start the bounded Admin appointment UI batch.