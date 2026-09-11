# HIU YHCT 4.0 — Execution State

Updated: 2026-09-12
Branch: `hiu-quiz-pipeline-phase2-b3b-pdf-20260912`
Base production-verified main: `aae40aaa2b056fb247d0bc96c45b3121dac084e8`
Pull request: `#76`
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

## PHASE 2 — batch 1 — DONE / PRODUCTION VERIFIED

- Resumable V2 `quiz-start` / `quiz-process-chunk` / `quiz-retry`, deterministic IDs, bounded chunks and revision CAS.
- Human review/commit remains authoritative.
- Production migration `quiz_pipeline_v2_cas` applied and verified.
- PR `#73` merged at `a5ced40920459bd94d2bcde54b7b26caff839f4b`.
- Main Web CI `#594`, Vercel Production `#478`, deployment `dpl_8qSCVaSXuQXTAJxRDhT4bGxcacuF`, alias and live Chrome: PASS/READY.

## PHASE 2 — batch 2 — DONE / PRODUCTION VERIFIED

- Shared resumable client runner used by Learning Manager and Admin ACC.
- ACC Drive preview, DOCX upload and bulk conversion use pipeline V2; persisted drafts resume/retry from history.
- Legacy backend `quiz-preview` retained for compatibility; human `quiz-commit` and RBAC unchanged.
- PR `#74` merged at `c972db6ee2ba4b3598434b1ac9438017a2a5091b`.
- Main Web CI `#598`: PASS.
- Vercel Production `#482`: PASS.
- Deployment `dpl_FMh58jA8UWpHUd5RkHNdzKWHr4Z8`: READY, exact SHA, production alias and live Chrome/evidence PASS.

## PHASE 2 — batch 3A TXT — DONE / PRODUCTION VERIFIED

- Direct UTF-8 `.txt` upload added beside DOCX in Learning Manager and Admin ACC.
- Fail-closed validation: base64, <=2 MB decoded bytes, fatal UTF-8, non-empty text, <=400,000 normalized characters.
- CRLF/NUL normalization is explicit; source hash derives from original bytes; full normalized source persists for evidence review.
- Existing Drive DOCX / Google Docs / TXT behavior unchanged.
- No DB/RPC/role/dependency changes.
- PR `#75` merged at `aae40aaa2b056fb247d0bc96c45b3121dac084e8`.
- Main Web CI `#601`: FULL PASS.
- Vercel Production `#485`: PASS.
- Deployment `dpl_9LHLLa6yq7VdCiWbMwVY64iy3iCz`: READY, exact SHA, production alias and live Chrome/evidence PASS.

## PHASE 2 — batch 3B PDF — CODE QA DONE / MERGE PENDING

Goal: add direct PDF source ingestion without OCR, silent truncation, role expansion or review bypass.

Implemented:
- Direct upload accepts `.pdf` beside DOCX/TXT in Learning Manager and Admin ACC.
- Server-only parser dependency pinned exactly to `pdf-parse` `2.4.5`.
- PDF validation/extraction is fail-closed:
  - base64 syntax checked;
  - decoded binary <= 2 MB;
  - `%PDF-` signature required;
  - page count must be 1–80;
  - extracted source <= 400,000 characters;
  - encrypted/password PDFs rejected;
  - PDFs without a substantive text layer rejected; no automatic OCR;
  - parser-generated page markers are removed before the no-text check;
  - source hash derives from original PDF bytes.
- Extracted source is retained in the existing `sourceText` evidence/review path.
- Pipeline V2, revision CAS, human `quiz-commit`, Learning Manager capability and Admin boundaries are unchanged.
- No DB/RPC/role migration.
- Drive PDF browsing is intentionally not expanded in this batch; PDF support is direct-upload only.

Changed files:
- `package.json`
- `api/_lib/pdf-quiz-source.js`
- `api/_lib/quiz-pipeline-v2.js`
- `src/services/quizWorkspaceService.ts`
- `src/components/admin/LearningContentManagerPanel.tsx`
- `src/components/admin/QuizImportCenter.tsx`
- `scripts/pdf-quiz-source-check.mjs`
- `scripts/v22-quiz-import-check.mjs`
- `.github/workflows/web-ci.yml`
- `docs/HIU_EXECUTION_STATE.md`

Verification before checkpoint:
- PR `#76`.
- CI `#602`: existing TXT contract correctly caught stale `docx|txt` source-picker expectation before PDF regression ran; contract was updated to require `docx|txt|pdf` without weakening TXT checks.
- CI `#603`: DOCX/TXT suite 12/12 PASS and real PDF extraction PASS; empty-PDF fixture exposed parser-only page markers being mistaken for source text.
- Source fix `ecf29a1d89b57f00110ac7d16f4ae925dcc1f17f` strips only parser page markers before the no-text gate.
- CI `#604`: FULL PASS.
- DOCX/TXT/PDF + authorization regression: PASS, including real generated PDF extraction, deterministic byte hash, invalid signature rejection and no-text/no-OCR rejection.
- npm audit high: 0 vulnerabilities.
- Role/application/Y Quan contracts: PASS.
- TypeScript + Vite production build: PASS.
- Real Google Chrome responsive smoke: PASS.
- Adaptive mobile/full-desktop-on-phone/Windows viewport matrix: PASS.
- QA evidence and build artifact integrity: PASS.

## Remaining batch 3B release gates

1. Run Web CI on this exact checkpoint head.
2. If green, verify PR `#76` mergeability and squash-merge with expected-head guard.
3. Verify full Web CI on the resulting `main` commit.
4. Verify fresh Vercel production deployment matches exact main SHA, reaches READY, binds production alias and passes live Chrome/evidence.
5. Then mark PHASE 2 source-format hardening production verified and proceed to PHASE 3 Learning Hub restructuring.

## Remaining high-level phases

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

Wait for checkpoint CI on PR `#76`; if green, merge and verify main CI + exact Vercel production/live Chrome release before entering PHASE 3.
