# HIU YHCT 4.0 — Execution State

Updated: 2026-09-11
Branch: `hiu-quiz-pipeline-phase2-b3-20260911`
Base production-verified main: `c972db6ee2ba4b3598434b1ac9438017a2a5091b`
Pull request: `#75`
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

## PHASE 1 — DONE / PRODUCTION VERIFIED

- ACC compact grouping, scoped Learning Manager capability/UI and Admin appointment flow shipped through PRs `#70`–`#72`.
- `/acc` remains Admin-only; frozen module and role contracts preserved.
- Main CI, production deployment, aliases and live Chrome verification passed.

## PHASE 2 — bounded batch 1 — DONE / PRODUCTION VERIFIED

- Added resumable `quiz-start` / `quiz-process-chunk` / `quiz-retry` pipeline with deterministic IDs, bounded chunks, persisted state and revision CAS.
- Existing `practice_import_drafts_v2` and human review/commit gates remain authoritative.
- Production migration `quiz_pipeline_v2_cas` applied and verified with fail-closed learning-content authorization; no new table/enum/policy/index.
- PR `#73` merged at `a5ced40920459bd94d2bcde54b7b26caff839f4b`.
- Main Web CI `#594`: PASS.
- Vercel Production `#478`: PASS.
- Deployment `dpl_8qSCVaSXuQXTAJxRDhT4bGxcacuF`: READY, production alias bound, live Chrome/evidence PASS.

## PHASE 2 — bounded batch 2 — DONE / PRODUCTION VERIFIED

Goal: move Admin ACC onto the same resumable V2 client orchestration and recover persisted jobs from draft history.

Implemented:
- Shared `continueQuizPipeline`, `startQuizPipeline`, `retryQuizPipeline` client helpers.
- Learning Manager and ACC share one resumable runner.
- ACC Drive preview, DOCX upload and bulk conversion use V2; legacy backend `quiz-preview` remains for compatibility.
- ACC displays persisted progress/attempt/error and resumes `processing` or retries `error` drafts.
- Edit/import is blocked while pipeline is processing/error; human `quiz-commit` gate and RBAC unchanged.
- No DB/RPC/role/backend migration changes.

Release verification:
- PR `#74` squash-merged to `main` at `c972db6ee2ba4b3598434b1ac9438017a2a5091b`.
- Main Web CI `#598`: PASS.
- Vercel Production workflow `#482`: PASS.
- Production deployment `dpl_FMh58jA8UWpHUd5RkHNdzKWHr4Z8`: READY.
- Deployment Git SHA matched `c972db6ee2ba4b3598434b1ac9438017a2a5091b`.
- Production alias `yhct-hiu-final4-stage.vercel.app` bound with `aliasError=null`.
- Live Google Chrome production smoke, evidence upload and deployment summary: PASS.

## PHASE 2 — bounded batch 3A — CODE QA DONE / MERGE PENDING

Goal: add a second direct-upload text source format without introducing a new parser dependency or weakening evidence/review controls.

Implemented:
- Direct upload now accepts `.docx` and UTF-8 `.txt` in Learning Manager and Admin ACC.
- Added generic `sourceFileBase64`; legacy `wordBase64` remains compatible for DOCX callers.
- TXT extraction occurs server-side inside pipeline V2 before parsing/generation.
- TXT validation is fail-closed:
  - base64 syntax validated;
  - decoded binary <= 2 MB;
  - UTF-8 decoding uses `fatal: true`;
  - empty text rejected;
  - normalized source <= 400,000 characters;
  - CRLF normalized and NUL removed;
  - source hash derives from original bytes;
  - MIME metadata is `text/plain`.
- Full normalized TXT source is persisted as `sourceText` for human evidence review.
- Existing Drive DOCX / Google Docs / TXT behavior unchanged.
- Resumable chunks, CAS, `quiz-commit`, Admin/Learning Manager RBAC and legacy DOCX path unchanged.
- No database, RPC, role or dependency changes.
- PDF intentionally remains outside this bounded batch because the repository currently has no server PDF parser dependency; PDF will require a separately pinned Node/Vercel parser and dedicated extraction regression.

Changed files:
- `api/_lib/quiz-pipeline-v2.js`
- `src/services/quizWorkspaceService.ts`
- `src/components/admin/LearningContentManagerPanel.tsx`
- `src/components/admin/QuizImportCenter.tsx`
- `scripts/v22-quiz-import-check.mjs`
- `docs/HIU_EXECUTION_STATE.md`

Verification before checkpoint:
- PR `#75`.
- Web CI `#599` on pre-checkpoint head: PASS.
- Quiz import/parser/DOCX/auth + TXT source-format regression: PASS.
- Role/RBAC and application audits: PASS.
- TypeScript + Vite production build: PASS.
- Real Google Chrome responsive smoke: PASS.
- Adaptive mobile/full-desktop-on-phone/Windows viewport matrix: PASS.
- QA evidence and artifact integrity: PASS.

## Remaining batch 3A release gates

1. Run Web CI on this checkpoint commit.
2. If green, squash-merge PR `#75`.
3. Verify Web CI on resulting `main` commit.
4. Verify fresh Vercel production deployment has exact main SHA, reaches READY, binds production alias and passes live Chrome/evidence.
5. Only then mark batch 3A production verified.

## Remaining high-level phases

2. Continue Document → Quiz hardening: PDF direct upload as a separate parser/dependency batch, then close source-format work.
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

Wait for CI on this checkpoint commit. If green, merge PR `#75` and verify main CI + Vercel production/live Chrome before starting the isolated PDF parser batch.
