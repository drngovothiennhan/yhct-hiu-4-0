# HIU YHCT 4.0 — Execution State

Updated: 2026-09-11
Branch: `hiu-learning-manager-ui-phase1-20260911`
Base: `main` @ `19cda6628d09765b3576a4acf8abc922c2c9238b`
Pull request: `#72`
Production project: `yhct-hiu-final4-stage`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 1 — ACC / Admin Control Center

## PHASE 0 — DONE

- Repository, `main`, Vite/React/TypeScript runtime, Vercel production, Supabase, auth, role hierarchy, AI integrations and major UI modules baselined.
- Auth/RLS, SystemRole contracts, approved quiz bank, AI role boundaries, HIU Y Quan game/score state and production deployment flow remain `DO_NOT_BREAK`.

## PHASE 1 — bounded batch 1 — DONE / PRODUCTION VERIFIED

- ACC grouped into `Tổng quan`, `Học tập`, `A.I Center`, `Nội dung`, `Vận hành`.
- Only selected operational section renders.
- PR `#70` merged at `fa545002ca7d52c27673014aedf6bcb06445a44e`.
- Main CI, production build, Chrome responsive smoke, viewport matrix and Vercel live production smoke passed.

## PHASE 1 — bounded batch 2A — DONE / PRODUCTION VERIFIED

Goal: scoped `Ban Quản lý Học tập` backend capability without adding a new SystemRole.

- `app_role` remains exactly `guest/member/mod/super_mod/leader/admin`.
- Learning capability is based on exact `position_title` and requires approved membership, login enabled and no data conflict.
- Scope: document-to-quiz workspace, quiz ingestion and quiz review only.
- Research Drive administration, user management, ACC system operations and A.I diagnostics remain on existing Admin gates.
- Production migration `learning_content_manager_capability` applied and verified.
- PR `#71` merged to `main` at `19cda6628d09765b3576a4acf8abc922c2c9238b`.
- Main Web CI `#586`: PASS.
- Vercel production workflow `#469`: PASS including alias binding and live Google Chrome production smoke.
- Production deployment `dpl_BRG9U1tFLnYtTtPJB5kK99VZWqNS`: READY, commit `19cda662...`.

## PHASE 1 — bounded batch 2B — CODE QA DONE / MERGE PENDING

Goal: Admin appointment UI plus a learning-only operational surface for the scoped capability.

Changed files:
- `src/types/index.ts`
- `src/components/admin/AdminControlCenter.tsx`
- `src/components/admin/LearningContentManagerPanel.tsx`
- `src/App.tsx`
- `scripts/role-ui-audit.mjs`
- `docs/HIU_EXECUTION_STATE.md`

Implemented:
- Added appointment title `Ban Quản lý Học tập`; SystemRole enum remains unchanged.
- Client capability mirrors backend fail-closed state: approved, login enabled, no data conflict, plus Admin or exact learning title.
- When a non-Admin is appointed to the learning role, Admin UI keeps SystemRole at `member` and disables higher system-role selection for that appointment.
- Frozen 10-module contract is preserved; no new module/route was created.
- `/admin` is reused safely: Moderator/Admin receives existing `AdminControlCenter`; a learning-only member receives only `LearningContentManagerPanel`.
- `/acc` remains gated by `canAcc=roleAtLeast(member?.role,'admin')` and is never rendered to the learning-only surface.
- Learning panel supports DOCX → quiz draft → source review → explicit import and the quiz review queue.
- New role audit asserts the learning-manager appointment boundary, `/admin` restricted rendering and `/acc` isolation.

Verification:
- PR `#72`, head before checkpoint `e1665290104bb66f28a846c922a670dc54367362`.
- Web CI `#587`: PASS.
- Platform/role audit: PASS.
- Quiz parser/DOCX/authorization regression: PASS.
- TypeScript + Vite production build: PASS.
- Real Chrome mobile/desktop smoke: PASS.
- Adaptive mobile/full-desktop-on-phone/Windows viewport matrix: PASS.
- No database/schema changes in batch 2B.

## Remaining PHASE 1 work

1. Run CI for this checkpoint commit.
2. If green, squash-merge PR `#72`.
3. Verify main CI, Vercel READY deployment, production alias and live Chrome production smoke.
4. Close PHASE 1 only after production verification.

## Remaining high-level phases

2. Document → Quiz pipeline hardening: PDF/DOCX/TXT, states, progress, retry, idempotency and large-document batching.
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

Wait for checkpoint CI. If green, merge PR `#72` and verify the fresh production release before entering PHASE 2.