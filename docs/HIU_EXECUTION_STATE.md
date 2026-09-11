# HIU YHCT 4.0 — Execution State

Updated: 2026-09-11
Branch: `hiu-quiz-pipeline-phase2-20260911`
Base: `main` @ `ca12e254220837f9d77a914bd507640061706978`
Pull request: `#73`
Production project: `yhct-hiu-final4-stage`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 2 — Document → Quiz pipeline hardening

## DO_NOT_BREAK

- Authentication/session restore and current Supabase ACL/RLS behavior.
- Existing `SystemRole` hierarchy and production role RPC contracts.
- Approved quiz bank, explicit human review gate, daily practice and free-practice behavior.
- `Ban Quản lý Học tập` remains a scoped capability/appointment, not a new SystemRole.
- `/acc` remains Admin-only.
- AI canonical role boundaries: App Assistant / Research / module capability.
- HIU Y Quan game state, score/progression and existing game contract tests.
- Current production aliases and Vercel Git integration.

## PHASE 0 — DONE

- Repository, runtime, Vercel production, Supabase, auth, role hierarchy, AI integrations and major UI modules baselined.

## PHASE 1 — DONE / PRODUCTION VERIFIED

### Batch 1 — compact ACC
- ACC grouped into `Tổng quan`, `Học tập`, `A.I Center`, `Nội dung`, `Vận hành` with selected-section rendering.
- PR `#70` merged at `fa545002ca7d52c27673014aedf6bcb06445a44e`; main CI and production smoke passed.

### Batch 2A — scoped learning-content capability
- `app_role` remains exactly `guest/member/mod/super_mod/leader/admin`.
- `Ban Quản lý Học tập` capability requires approved membership, login enabled and no data conflict.
- Scope is limited to document-to-quiz workspace, quiz ingestion and quiz review.
- PR `#71` merged at `19cda6628d09765b3576a4acf8abc922c2c9238b`.
- Production migration `learning_content_manager_capability` applied and verified.
- Vercel deployment `dpl_BRG9U1tFLnYtTtPJB5kK99VZWqNS` READY; live production Chrome smoke passed.

### Batch 2B — appointment UI + learning-only surface
- Appointment title `Ban Quản lý Học tập` added without changing the SystemRole enum.
- Non-Admin learning managers stay at `member` SystemRole.
- Frozen 10-module contract preserved; `/admin` is reused for the learning-only workspace while Moderator/Admin keep the existing Admin Control Center.
- `/acc` remains strictly Admin-only.
- PR `#72` merged to `main` at `ca12e254220837f9d77a914bd507640061706978`.
- Main Web CI `#589`: PASS.
- Vercel Production workflow `#472`: PASS including live Chrome production smoke.
- Production deployment `dpl_3RsiMdkEhXBh6dKLF2NfhCfGDcc3`: READY; production aliases bound successfully.

## PHASE 2 — bounded batch 1 — CODE/DB QA DONE / MERGE PENDING

Goal: make long-document quiz conversion resumable, idempotent and observable without replacing the stable legacy import path.

Architecture:
- Legacy `quiz-preview` remains intact for the existing Admin ACC workflow in this batch.
- New pipeline is client-orchestrated and durable; it does not pretend to be a background worker.
- `quiz-start` creates or resumes a deterministic draft/job using `file + sourceHash + subject + mode`.
- `quiz-process-chunk` processes exactly one bounded source chunk per request.
- `quiz-retry` resumes from the persisted failed chunk; final no-grounded-question failures can restart the generation sequence safely.
- Source chunks are bounded to 12,000 characters with 450-character overlap and a hard maximum of 48 chunks.
- Gemini can generate at most 10 draft questions per chunk and every accepted generated question must contain evidence text found in that chunk.
- Generated question IDs and job IDs are deterministic; duplicate generated questions are suppressed.
- Progress, attempts, failed chunk, last error and timestamps are persisted inside the existing draft payload.
- Optimistic CAS on `revision` prevents stale clients from overwriting newer progress.
- Existing human confirmation/import and review gates remain authoritative.

Changed files:
- `ops/sql/20260911_quiz_pipeline_v2_cas.sql`
- `api/_lib/quiz-pipeline-v2.js`
- `api/ai/drive-rag.js`
- `src/services/quizWorkspaceService.ts`
- `src/components/admin/LearningContentManagerPanel.tsx`
- `scripts/v22-quiz-import-check.mjs`
- `scripts/role-ui-audit.mjs`
- `docs/HIU_EXECUTION_STATE.md`

Database:
- Production migration `quiz_pipeline_v2_cas` applied only after CI #592 passed.
- Existing table `practice_import_drafts_v2` and RPC signature `practice_import_workspace_v2(text,text,jsonb)` are retained; no new table, enum, policy or index was introduced.
- New `replace` action requires exact revision match, validates draft/question/payload bounds, increments revision and returns the persisted state.
- Function remains `SECURITY DEFINER` with empty `search_path` and internal `private.is_learning_content_manager()` fail-closed authorization.
- Direct privilege verification: `anon` EXECUTE = false; `authenticated` = true; `service_role` = true.
- Migration is present in production history as `quiz_pipeline_v2_cas`.
- Supabase advisors show existing project-wide security/performance findings; this migration did not introduce a new schema object or advisor category attributable to this bounded batch.

Verification:
- PR `#73` current head before this checkpoint: `afe5732a7090232e9e1340721dd286b16114887d`.
- CI `#590`: baseline contracts passed; first new chunk-planner test exposed a final-chunk completion bookkeeping bug.
- Fix `2b3cf39da30f42564a751ded3848e9ca9f257bf0` marks the final chunk as fully consumed without changing chunk limits or authorization.
- CI `#591`: all 11 quiz tests passed; build then stopped because the static RBAC audit still expected legacy `quiz-preview` text on the Learning Manager surface.
- Audit-only fix `afe5732a7090232e9e1340721dd286b16114887d` now checks `quiz-start/process/retry` while retaining negative ACC/system assertions.
- CI `#592`: PASS.
- Quiz parser/DOCX/authorization/pipeline regression: 11/11 PASS.
- Role/RBAC audits: PASS.
- TypeScript + Vite production build: PASS.
- Real Google Chrome mobile/desktop smoke: PASS.
- Adaptive mobile/full-desktop-on-phone/Windows viewport matrix: PASS.
- Build artifact integrity gate: PASS.

## Remaining PHASE 2 batch 1 release gates

1. Run CI on this checkpoint documentation commit.
2. If green, squash-merge PR `#73`.
3. Verify Web CI on the resulting `main` commit.
4. Verify fresh Vercel production deployment points to that exact main commit, reaches READY, binds production alias and passes live Chrome production smoke.
5. Only then mark PHASE 2 batch 1 production verified.

## Remaining high-level phases

2. Continue Document → Quiz hardening after batch 1: migrate the Admin ACC bulk workflow to the resumable contract, improve draft resume/history UX, then add additional source formats only with parser/evidence coverage.
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

Wait for CI on this checkpoint-only documentation commit. If green, merge PR `#73`, verify main CI and the fresh Vercel production/live Chrome release, then continue with the next bounded PHASE 2 quiz-pipeline batch.