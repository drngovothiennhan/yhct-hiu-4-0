# HIU YHCT 4.0 — Execution State

Updated: 2026-09-12
Active branch: `hiu-profile-achievements-phase6-20260912`
Base production-verified main: `ba7ea8c9d4430ae8fe97cde60a8f70f72d1a58fb`
Production project: `yhct-hiu-final4-stage`
Primary production alias: `yhct-hiu-final4-stage.vercel.app`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 6 — Profile learning achievements / server-authoritative HIU Y Quán title.

## DO_NOT_BREAK

- Authentication/session restore and current Supabase ACL/RLS behavior.
- Existing `SystemRole` hierarchy and production role RPC contracts.
- Approved quiz bank, explicit human review gate, daily practice and free-practice behavior.
- `Ban Quản lý Học tập` remains a scoped capability/appointment, not a new SystemRole.
- `/acc` remains Admin-only.
- Frozen 10-module navigation contract; `/exam` remains the learning/exam route.
- AI canonical role boundaries: App Assistant / Research / module capability.
- National Exam server-authoritative session/scoring contracts.
- HIU Y Quán game state, score/progression and existing game contract tests.
- Current production aliases and Vercel Git integration.

## PHASE 1 — DONE / PRODUCTION VERIFIED

- ACC compact grouping, scoped Learning Manager capability/UI and Admin appointment flow shipped through PRs `#70`–`#72`.
- `/acc` remains Admin-only; frozen module and role contracts preserved.

## PHASE 2 — DONE / PRODUCTION VERIFIED

- Resumable V2 quiz pipeline, deterministic bounded chunks, revision CAS and retry/recovery shipped through PRs `#73`–`#74`.
- Human review/commit remains authoritative; no automatic publish bypass.
- Direct source upload supports DOCX, UTF-8 TXT and text-layer PDF.
- PDF parser pinned to `pdf-parse` `2.4.5`; invalid/encrypted/no-text PDFs fail closed; no automatic OCR/fabricated source text.
- Source evidence and byte-derived hashes are preserved through the review path.

## PHASE 3 — DONE / PRODUCTION VERIFIED

- `/exam` remains the canonical route and module id `exam`; no new Learning module was added.
- Learning Hub compact shell exposes quick review, free practice, spaced review and standard exam while preserving the existing server-authoritative National Exam engine.
- Existing quiz/session/scoring contracts, state-preserving mounts, mobile/desktop responsive behavior and Chrome regression gates passed before release.

## PHASE 4 — DONE / PRODUCTION VERIFIED

- Home/news surface was compacted without removing rollback-safe news backend contracts.
- Install/share/performance controls live in Settings; Home delegates AI interaction to the single Unified AI Mini.
- Weather integration is fail-soft and privacy-safe: Home does not request device geolocation; regional/IP weather is shown only when available.
- Fixed missing `lat/lon` coercion that previously converted null query values to `(0,0)`.
- Production verified at main `7dd87d73cdd83680da35ea037a8a2ad1ab4585f8`.
- Web CI `#621`: FULL PASS.
- Vercel Production `#506`: PASS.
- Deployment `dpl_DXvqZ2ASJcG62z3X2VucKZTqMUDD`: READY, exact SHA, primary alias and live Chrome/evidence PASS.

## PHASE 5 — DONE / PRODUCTION VERIFIED

- Notification list remains bounded to five recent rows, but unread count is authoritative across the complete member notification set.
- App shell owns one canonical unread count used by desktop sidebar, mobile bottom navigation and Notifications Center.
- Client no longer attempts direct table UPDATE.
- Production migration `notification_read_state_rpc_v1` adds narrow SECURITY DEFINER RPCs that can only mutate `read_at` for `private.current_member_id()`.
- Live ACL verified: authenticated `SELECT=true`, direct `UPDATE=false`, both read-state RPCs `EXECUTE=true`.
- Production verified at main `ba7ea8c9d4430ae8fe97cde60a8f70f72d1a58fb`.
- Web CI `#623`: FULL PASS.
- Vercel Production `#508`: PASS.
- Deployment `dpl_vT5fpHNNKbduuzem79VyQdmRUQw3`: READY, exact SHA, primary alias and live Chrome/evidence PASS.

## PHASE 6 — ACTIVE

Goal: add useful learning achievements to Profile without inventing official credentials or deriving game titles on the client.

Locked source contract:
- Device learning progress comes only from existing member-scoped `StudentJourney` state (`streak`, learning XP, exam attempts, last exam score, AI uses, module visits). It must be explicitly labeled as progress stored on this device.
- HIU Y Quán title/progress comes only from production RPC `hiu_y_quan_engagement_v15()`.
- Profile must not reimplement game XP thresholds or hardcode game titles.
- Game synchronization is read-only and fail-soft; game/RPC failure must not break the base profile, wall, DRL or password functions.
- No new module, DB schema, role, game mutation or navigation route.

Implementation in active branch:
- `profileAchievementService.ts` validates the server engagement payload and exposes only read-only profile fields.
- `ProfileAchievements.tsx` shows device-local learning metrics and server-confirmed HIU Y Quán title/level/XP/streak/mastery.
- Achievement UI is isolated in `profile-achievements.css` and mounted as a child of existing ProfileCenter.
- `profile-achievement-check.mjs` locks source honesty, read-only game behavior and no hardcoded titles; it is wired into Web CI.

## Remaining high-level phases

7. Responsive UI/UX cleanup.
8. Version cleanup by reference/dependency evidence only.
9. Top-5 AI health issues by Impact × Frequency × Risk.
10. ACC AI/System Health safe-fix workflow.
11. Performance bottlenecks.
12. Final multi-viewport QA and production verification.

## Next gate

Open PHASE 6 PR, require full Web CI + TypeScript/Vite + real Chrome + rendered-content + viewport matrix, then squash-merge with expected-head guard. After merge, require full main CI and exact Vercel production READY/primary-alias/live-Chrome verification before marking PHASE 6 done.
