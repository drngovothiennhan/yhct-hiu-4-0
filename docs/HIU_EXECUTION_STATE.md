# HIU YHCT 4.0 — Execution State

Updated: 2026-09-12
Branch: `hiu-learning-hub-phase3-b1-20260912`
Base production-verified main: `95d03ce9e417e0775c2fd5f2f802a5bddeb2b434`
Pull request: `#77`
Production project: `yhct-hiu-final4-stage`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 3 — Learning Hub restructuring

## DO_NOT_BREAK

- Authentication/session restore and current Supabase ACL/RLS behavior.
- Existing `SystemRole` hierarchy and production role RPC contracts.
- Approved quiz bank, explicit human review gate, daily practice and free-practice behavior.
- `Ban Quản lý Học tập` remains a scoped capability/appointment, not a new SystemRole.
- `/acc` remains Admin-only.
- Frozen 10-module navigation contract; `/exam` remains the learning/exam route.
- AI canonical role boundaries: App Assistant / Research / module capability.
- National Exam server-authoritative session/scoring contracts.
- HIU Y Quan game state, score/progression and existing game contract tests.
- Current production aliases and Vercel Git integration.

## PHASE 1 — DONE / PRODUCTION VERIFIED

- ACC compact grouping, scoped Learning Manager capability/UI and Admin appointment flow shipped through PRs `#70`–`#72`.
- `/acc` remains Admin-only; frozen module and role contracts preserved.

## PHASE 2 — DONE / PRODUCTION VERIFIED

- Resumable V2 quiz pipeline, deterministic bounded chunks, revision CAS and retry/recovery shipped through PRs `#73`–`#74`.
- Human review/commit remains authoritative; no automatic publish bypass.
- Direct source upload supports DOCX, UTF-8 TXT and text-layer PDF.
- PDF parser pinned to `pdf-parse` `2.4.5`; limits: <=2 MB, 1–80 pages, <=400,000 extracted characters.
- Invalid/encrypted/no-text PDFs fail closed; no automatic OCR or fabricated source text.
- Source evidence and byte-derived hashes are preserved through the existing review path.
- PR `#75` TXT release: main Web CI `#601`, Vercel Production `#485`, deployment `dpl_9LHLLa6yq7VdCiWbMwVY64iy3iCz`: PASS/READY/live Chrome.
- PR `#76` PDF release merged at `95d03ce9e417e0775c2fd5f2f802a5bddeb2b434`.
- Main Web CI `#606`: FULL PASS.
- Vercel Production `#490`: PASS.
- Deployment `dpl_t52bdZB4agq18tvtNEjk7wpTt4UZ`: READY, exact SHA, production alias `yhct-hiu-final4-stage.vercel.app`, live Chrome/evidence PASS.

## PHASE 3 — batch 1 Learning Hub shell — CODE QA DONE / MERGE PENDING

Goal: compact the existing `/exam` experience without changing data, services, scoring or the frozen module contract.

Implemented:
- `/exam` remains the canonical route and module id `exam`; no new `/learning` module/route.
- Existing production-proven National Exam engine is preserved as `NationalExamPrepLegacy.tsx` with server-authoritative session/scoring unchanged.
- `ExamCenter.tsx` is now a compact Learning Hub shell with four experiences:
  - Ôn tập nhanh;
  - Luyện thi tự do;
  - Ôn tập ngắt quãng;
  - Thi chuẩn.
- Only Ôn tập nhanh mounts initially; other experiences mount on first visit and stay mounted so in-progress state is preserved while switching tabs.
- Only the selected panel is visible; ARIA `tab`/`tabpanel` semantics are used.
- Legacy embedded quick/bank/adaptive blocks are hidden only inside the preserved Thi chuẩn implementation to avoid duplicate stacked UI.
- Responsive Learning Hub navigation uses 4-column desktop, 2-column medium and horizontal-scroll compact layout.
- No DB/RPC/role/service/session/scoring changes.

Audit/test hardening:
- `learning-hub-contract-check.mjs` locks the four-tab shell, state-preserving first-visit mounting, `/exam` route and frozen 10-module contract.
- Existing acceptance markers remain available at the `/exam` entrypoint while real session logic remains inside the preserved engine.
- AI runtime audit now follows the shell to `NationalExamPrepLegacy.tsx` and still verifies the real AI Platform facade + local degraded tutor fallback.
- Real Chrome smoke now verifies `/exam` reload stability on Learning Hub, clicks `Thi chuẩn`, verifies ARIA selected/visible state, `National Exam Prep` and `50 câu`, then captures evidence.

Verification:
- PR `#77`.
- CI `#607`: exposed stale acceptance assumption tied to old `ExamCenter.tsx` structure; fixed without weakening gate.
- CI `#608`: Learning Hub structural regression PASS; prebuild AI audit exposed the same shell/implementation assumption and was corrected to inspect real implementation.
- CI `#609`: all static contracts/build PASS; old Chrome smoke correctly failed because it expected National Exam as the default `/exam` surface.
- Chrome smoke upgraded to exercise the new default Learning Hub plus explicit Thi chuẩn click-through.
- CI `#610` on code head `e129a79ad904af4d93b03a13c05dda3ebcbc47b0`: FULL PASS.
- Acceptance/platform/roles/AI/RAG/quiz/Y Quan audits: PASS.
- Learning Hub structural regression: PASS.
- TypeScript + Vite production build: PASS.
- Real Google Chrome responsive smoke with Learning Hub → Thi chuẩn interaction: PASS.
- Adaptive mobile/full-desktop-on-phone/Windows viewport matrix: PASS.
- QA evidence and build artifact integrity: PASS.

## Remaining PHASE 3 batch 1 release gates

1. Verify PR `#77` mergeability after this docs-only checkpoint.
2. Squash-merge with expected-head guard.
3. Verify full Web CI on resulting `main` commit.
4. Verify Vercel production deployment matches exact main SHA, reaches READY, binds production alias and passes live Chrome/evidence.
5. Only then mark PHASE 3 batch 1 production verified and continue the next bounded Learning Hub improvement.

## Remaining high-level phases

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

Merge PR `#77` if mergeable, then require full main CI + exact Vercel production READY/alias/live Chrome verification before any further feature work.
