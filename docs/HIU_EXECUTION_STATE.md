# HIU YHCT 4.0 — Execution State

Updated: 2026-09-11
Branch: `hiu-quiz-pipeline-phase2-b2-20260911`
Base production-verified main: `a5ced40920459bd94d2bcde54b7b26caff839f4b`
Pull request: `#74`
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

- Compact ACC grouping shipped through PR `#70`.
- Scoped `Ban Quản lý Học tập` capability shipped through PR `#71`; SystemRole enum unchanged.
- Learning-only `/admin` operational surface and Admin appointment UI shipped through PR `#72` at `ca12e254220837f9d77a914bd507640061706978`.
- `/acc` remains Admin-only; frozen 10-module contract preserved.
- Main CI, Vercel production deployment, aliases and live Chrome production smoke passed for PHASE 1.

## PHASE 2 — bounded batch 1 — DONE / PRODUCTION VERIFIED

Goal: make long-document quiz conversion resumable, idempotent and observable without breaking the stable import/review path.

Implemented:
- Added `quiz-start`, one-chunk-per-request `quiz-process-chunk`, and `quiz-retry`.
- Deterministic job IDs use file + source hash + subject + conversion mode.
- Generation chunks are bounded to 12,000 characters with 450-character overlap and max 48 chunks.
- Gemini generates at most 10 draft questions per chunk and every accepted generated question must contain evidence text found in that source chunk.
- Persisted pipeline state includes progress, attempt, failed chunk, retryability, error and timestamps.
- Existing `practice_import_drafts_v2` storage is reused.
- Added revision-CAS `replace` action to `practice_import_workspace_v2`; no new table, enum, policy or index.
- Existing human confirmation/import and review gates remain authoritative.
- Legacy `quiz-preview` backend remains available for backward compatibility.

Database verification:
- Production migration `quiz_pipeline_v2_cas` applied and verified.
- RPC remains `SECURITY DEFINER`, empty `search_path`, with internal `private.is_learning_content_manager()` fail-closed authorization.
- `anon` EXECUTE = false; `authenticated` = true; `service_role` = true.
- Advisors showed existing project-wide findings only; this bounded migration introduced no new schema object/category.

Release verification:
- PR `#73` squash-merged to `main` at `a5ced40920459bd94d2bcde54b7b26caff839f4b`.
- Main Web CI `#594`: PASS.
- Quiz parser/DOCX/authorization/pipeline regression: 11/11 PASS.
- Role/RBAC audits: PASS.
- TypeScript + Vite production build: PASS.
- Real Google Chrome responsive smoke: PASS.
- Adaptive mobile/full-desktop-on-phone/Windows viewport matrix: PASS.
- Vercel Production workflow `#478`: PASS.
- Production deployment `dpl_8qSCVaSXuQXTAJxRDhT4bGxcacuF`: READY.
- Production alias `yhct-hiu-final4-stage.vercel.app` bound with `aliasError=null`.
- Deployment metadata Git SHA matched `a5ced40920459bd94d2bcde54b7b26caff839f4b`.
- Live Google Chrome production smoke and evidence upload: PASS.

## PHASE 2 — bounded batch 2 — CODE QA DONE / MERGE PENDING

Goal: move the Admin ACC document workflow onto the production-proven resumable V2 contract and make persisted draft progress directly recoverable from ACC history.

Implemented:
- Added shared client orchestration in `quizWorkspaceService.ts`:
  - `continueQuizPipeline`
  - `startQuizPipeline`
  - `retryQuizPipeline`
- Both Learning Manager and Admin ACC now use the same resumable client runner rather than maintaining separate chunk loops.
- ACC Drive file preview now starts pipeline V2 instead of invoking legacy `quiz-preview`.
- ACC direct DOCX upload now starts pipeline V2.
- ACC bulk Drive conversion now processes each file through the resumable pipeline and keeps the draft when an error occurs.
- Active ACC draft displays persisted percent, chunk progress, attempt and last error.
- Draft history uses persisted `pipelineState` / `pipelineProgress` and directly continues `processing` drafts or retries `error` drafts.
- ACC edit and commit actions are blocked while a pipeline is `processing` or `error` to avoid revision races.
- `Dừng sau tệp hiện tại` keeps already-persisted draft progress and stops before the next file.
- Legacy backend `quiz-preview` remains intact for backward compatibility; ACC conversion paths no longer call it.
- Human `quiz-commit` approval gate, Admin RBAC and Learning Manager capability scope are unchanged.
- No database, RPC signature, role enum, backend route or migration changes in batch 2.

Changed files:
- `src/services/quizWorkspaceService.ts`
- `src/components/admin/LearningContentManagerPanel.tsx`
- `src/components/admin/QuizImportCenter.tsx`
- `scripts/v22-quiz-import-check.mjs`
- `docs/HIU_EXECUTION_STATE.md`

Verification before checkpoint:
- PR `#74`.
- CI `#595` on pre-checkpoint head: PASS.
- Quiz import/parser/DOCX/authorization + shared resumable UI regression: PASS.
- Role/RBAC audits: PASS.
- TypeScript + Vite production build: PASS.
- Real Google Chrome responsive smoke: PASS.
- Adaptive mobile/full-desktop-on-phone/Windows viewport matrix: PASS.
- Build artifact integrity: PASS.
- PR mergeability: true.

## Remaining PHASE 2 batch 2 release gates

1. Run CI on this checkpoint documentation commit.
2. If green, squash-merge PR `#74`.
3. Verify Web CI on the resulting `main` commit.
4. Verify fresh Vercel production deployment points to that exact main commit, reaches READY, binds the production alias and passes live Chrome production smoke.
5. Only then mark PHASE 2 batch 2 production verified.

## Remaining high-level phases

2. Continue Document → Quiz hardening after batch 2: add additional direct-upload source formats only with parser/evidence coverage and without weakening review gates.
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

Wait for CI on this checkpoint commit. If green, merge PR `#74`, then verify main CI and the fresh Vercel production/live Chrome release before entering the next bounded PHASE 2 batch.
