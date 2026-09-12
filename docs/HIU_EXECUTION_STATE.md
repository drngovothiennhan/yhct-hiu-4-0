# HIU YHCT 4.0 — Execution State

Updated: 2026-09-12
Active branch: `hiu-responsive-phase7-b1-20260912`
Base production-verified main: `62a3c75d70d7c934407e813c7ed243cf0fb09f27`
Production project: `yhct-hiu-final4-stage`
Primary production alias: `yhct-hiu-final4-stage.vercel.app`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 7 — Responsive UI/UX cleanup, Batch 1 mobile shell safety.

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
- Full-desktop-on-phone viewport contract and current production aliases/Vercel Git integration.

## PHASE 1 — DONE / PRODUCTION VERIFIED

- ACC compact grouping and scoped Learning Manager capability/UI shipped through PRs `#70`–`#72`.

## PHASE 2 — DONE / PRODUCTION VERIFIED

- Resumable V2 document-to-quiz pipeline shipped through PRs `#73`–`#76`.
- DOCX, UTF-8 TXT and bounded text-layer PDF direct upload preserve source evidence and human approval; no automatic OCR/fabricated source text.

## PHASE 3 — DONE / PRODUCTION VERIFIED

- `/exam` remains the canonical route with compact four-experience Learning Hub while preserving server-authoritative exam/session/scoring behavior.

## PHASE 4 — DONE / PRODUCTION VERIFIED

- Home/news compacted and regional weather made privacy-safe/fail-closed.
- Production main `7dd87d73cdd83680da35ea037a8a2ad1ab4585f8`; Web CI `#621`, Vercel `#506`, deployment `dpl_DXvqZ2ASJcG62z3X2VucKZTqMUDD`: PASS/READY/live Chrome.

## PHASE 5 — DONE / PRODUCTION VERIFIED

- Notification unread state is authoritative across the member notification set; direct client table UPDATE was replaced by narrow read-state RPCs.
- Production main `ba7ea8c9d4430ae8fe97cde60a8f70f72d1a58fb`; Web CI `#623`, Vercel `#508`, deployment `dpl_vT5fpHNNKbduuzem79VyQdmRUQw3`: PASS/READY/live Chrome.

## PHASE 6 — DONE / PRODUCTION VERIFIED

- Profile now surfaces existing member-scoped Student Journey metrics explicitly as progress stored on the current device.
- HIU Y Quán title, level, XP, streak and mastery are read only from `hiu_y_quan_engagement_v15()`; the client does not hardcode server titles or reimplement XP title thresholds.
- Game synchronization is read-only and fail-soft; base Profile/wall/DRL/password remain independent.
- No DB migration, role/module/navigation change or game mutation was introduced.
- PR `#83` exact code head `431ff4e71cb02df444e59acf641a6567524df3c4`; PR Web CI `#625`: FULL PASS.
- Production main `62a3c75d70d7c934407e813c7ed243cf0fb09f27`; main Web CI `#626`: FULL PASS.
- Vercel Production `#511`: PASS.
- Deployment `dpl_6tGZz3PvNRckgSpvGgou9B4Se4tT`: READY, exact SHA, primary alias, live Chrome/evidence PASS.

## PHASE 7 — Batch 1 ACTIVE

Goal: improve the mobile application shell without changing module data or behavior.

Audit findings:
- Existing viewport matrix strongly checks horizontal overflow and mobile/desktop mode, but does not assert shell touch-target size or fixed-element overlap.
- A late mobile override reduced the header “Thêm” control to `40x40`, below the Batch 1 44px shell target.
- Unified AI Mini used a fixed `bottom:78px`, leaving no real gap above the 78px mobile bottom navigation when safe-area is zero.
- Main already reserves bottom space, but the nav height/AI offset were maintained as independent constants and could drift.

Implemented in active branch:
- `responsive-phase7.css` is loaded last and is scoped only to `html[data-viewport-mode="mobile"][data-mobile-ui="social"]`.
- One mobile-nav height variable now drives bottom-nav height, main clearance and AI Mini offset, including `env(safe-area-inset-bottom)`.
- Header “Thêm” is restored to `44x44`; bottom-nav and sheet shell controls retain at least 44px touch height.
- AI Mini keeps a 10px measured gap above the bottom navigation.
- Forced desktop-on-phone and ordinary desktop selectors are untouched.
- New real-Chrome `mobile-shell-responsive-check.mjs` runs at 390x844 DPR3 after production build and fails on horizontal overflow, mobile-mode mismatch, <44px shell targets, inadequate main bottom clearance or AI Mini/bottom-nav overlap. It stores screenshot/JSON evidence in `browser-artifacts/`.
- Web CI runs this gate before the existing Chrome smoke/rendered-content/adaptive viewport matrix.

## Remaining high-level phases

8. Version cleanup by reference/dependency evidence only.
9. Top-5 AI health issues by Impact × Frequency × Risk.
10. ACC AI/System Health safe-fix workflow.
11. Performance bottlenecks.
12. Final multi-viewport QA and production verification.

## Next gate

Open the PHASE 7 Batch 1 PR and require full Web CI, including the new mobile-shell real-Chrome gate plus existing Chrome/viewport matrix. Only then squash-merge with expected-head guard and require full main CI + exact Vercel READY/primary-alias/live-Chrome production verification.
