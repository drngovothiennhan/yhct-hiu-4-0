# HIU YHCT 4.0 — Execution State

Updated: 2026-09-12
Active branch: `hiu-version-cleanup-phase8-b1-20260912`
Base production-verified main: `1a15f824ff285afd5cde6a8a233a4a19bb66a40f`
Production project: `yhct-hiu-final4-stage`
Primary production alias: `yhct-hiu-final4-stage.vercel.app`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 8 — Version cleanup by reference/dependency evidence only, Batch 1.

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
- Never delete a versioned file solely because its filename looks old; deletion requires zero active runtime/build/test reference or a verified current replacement.

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

- Profile surfaces existing member-scoped Student Journey metrics explicitly as progress stored on the current device.
- HIU Y Quán title, level, XP, streak and mastery are read only from `hiu_y_quan_engagement_v15()`; client does not hardcode server titles or reimplement XP title thresholds.
- Production main `62a3c75d70d7c934407e813c7ed243cf0fb09f27`; Web CI `#626`, Vercel Production `#511`, deployment `dpl_6tGZz3PvNRckgSpvGgou9B4Se4tT`: PASS/READY/live Chrome.

## PHASE 7 — DONE / PRODUCTION VERIFIED

- Mobile shell hardening uses one bottom-nav height contract to drive content clearance and Unified AI Mini offset.
- Header “Thêm” and shell controls retain at least 44px touch targets; Unified AI Mini maintains measured clearance above bottom navigation.
- Real-Chrome `mobile-shell-responsive-check.mjs` is enforced before the existing smoke/rendered-content/adaptive viewport matrix.
- PR `#84` exact head `8937c30...`: FULL PASS before merge.
- Production main `1a15f824ff285afd5cde6a8a233a4a19bb66a40f`; main Web CI `#630`: FULL PASS.
- Vercel Production `#515`: PASS.
- Deployment `dpl_Fx5qpUbns7cPWKVbdkQatBhQdmCA`: READY, exact SHA, primary alias, live Chrome/evidence PASS.

## PHASE 8 — Batch 1 ACTIVE

Goal: remove only proven-dead release/CI artifacts without touching active runtime, data, migrations, version contracts or historical documentation.

Evidence locked before deletion:
- `scripts/acceptance-check-v4.mjs` is active through `package.json#audit:source` and `prebuild`; retained.
- `public/version.json` is freshness-critical in `public/service-worker.js`; retained.
- `scripts/adaptive-viewport-check-v2.mjs` is the active viewport matrix; legacy `scripts/adaptive-viewport-check.mjs` has zero active references and is removed.
- `public/v12-release.txt` through `public/v17-release.txt` have zero active references and are not part of the service-worker/version contract; removed.
- Seven temporary CI/branch marker files under `docs/` have zero active references; removed.
- No migrations, game runtime/CSS, National Exam legacy implementation, active acceptance contracts or version metadata are removed in Batch 1.

Batch 1 commit before checkpoint docs: `d6f707bf1363ebc4328def78788f111c01c688ea`.

## Remaining high-level phases

9. Top-5 AI health issues by Impact × Frequency × Risk.
10. ACC AI/System Health safe-fix workflow.
11. Performance bottlenecks.
12. Final multi-viewport QA and production verification.

## Next gate

Open the PHASE 8 Batch 1 PR and require full Web CI. Only after exact-head PR CI passes, squash-merge with expected-head guard, then require full main CI and exact-SHA Vercel READY/primary-alias/live-Chrome production verification before declaring Phase 8 complete.
