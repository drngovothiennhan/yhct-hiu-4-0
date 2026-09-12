# HIU YHCT 4.0 — Execution State

Updated: 2026-09-12
Active branch: `hiu-performance-phase11-b2-css-20260912`
Base production-verified runtime main: `d0380e4e087d71db511940e9ecbe0da1bba35fd6`
Production project: `yhct-hiu-final4-stage`
Primary production alias: `yhct-hiu-final4-stage.vercel.app`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 11 B2 — CSS critical-path reduction. Branch-only until full PR/main/Vercel gates pass.

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
- Never weaken privacy/provenance gates to improve A.I availability.

## PHASE 1–3 — DONE / PRODUCTION VERIFIED

- ACC compact grouping + scoped Learning Manager capability/UI.
- Resumable V2 document-to-quiz pipeline with DOCX/TXT/bounded text-layer PDF source evidence and human approval.
- `/exam` remains canonical with four-experience Learning Hub and server-authoritative exam scoring.

## PHASE 4 — DONE / PRODUCTION VERIFIED

- Home/news compacted and regional weather made privacy-safe/fail-closed.
- Production main `7dd87d73cdd83680da35ea037a8a2ad1ab4585f8`; Web CI `#621`, Vercel `#506`, deployment `dpl_DXvqZ2ASJcG62z3X2VucKZTqMUDD`.

## PHASE 5 — DONE / PRODUCTION VERIFIED

- Notification unread state authoritative; narrow read-state RPC mutations replace direct client UPDATE.
- Production main `ba7ea8c9d4430ae8fe97cde60a8f70f72d1a58fb`; Web CI `#623`, Vercel `#508`, deployment `dpl_vT5fpHNNKbduuzem79VyQdmRUQw3`.

## PHASE 6 — DONE / PRODUCTION VERIFIED

- Profile uses real Student Journey metrics and server-authoritative HIU Y Quán title/progression.
- Production main `62a3c75d70d7c934407e813c7ed243cf0fb09f27`; Web CI `#626`, Vercel `#511`, deployment `dpl_6tGZz3PvNRckgSpvGgou9B4Se4tT`.

## PHASE 7 — DONE / PRODUCTION VERIFIED

- Mobile shell touch targets and Unified AI Mini/bottom-nav spacing guarded by real Chrome regression.
- Production main `1a15f824ff285afd5cde6a8a233a4a19bb66a40f`; Web CI `#630`, Vercel `#515`, deployment `dpl_Fx5qpUbns7cPWKVbdkQatBhQdmCA`.

## PHASE 8 — DONE / PRODUCTION VERIFIED

- Removed only proven-dead CI/release/version artifacts while preserving active runtime, migrations and contracts.
- Production main `6b640f46979e64234cc98d357fc7c8b2e6ddbb4f`; Web CI `#632`, Vercel `#517`, deployment `dpl_BRQcXspDMzmDkQWUWTLGY68Lm9yh`.

## PHASE 9 — DONE / AUDIT MERGED

- Source of truth: `docs/AI_HEALTH_TOP5_2026-09-12.md`.
- Ranked five A.I health issues by Impact × Frequency × Risk without fabricating traffic frequency.

## PHASE 10 — DONE / PRODUCTION VERIFIED

- Research preserves public provenance under internal opt-in.
- XiaoZhi/App Assistant telemetry is normalized and privacy-safe.
- ACC diagnostics use canonical server route with redaction/allowlist.
- `/api/ai/health` separates configuration from liveness/probe truth.
- Gemini-primary/OpenAI-fallback registry semantics aligned with runtime.
- Production main `8ba5bdb7f08c90a1719dd788bcf8db19a764023f`; PR CI `#635`, main CI `#636`, Vercel Production `#521`, deployment `dpl_HQdvrqguo4b3abkA6R8YRWU58k5p`: PASS/READY/live Chrome.

## PHASE 11 B1 — INITIAL PRELOAD GRAPH — DONE / PRODUCTION VERIFIED

Evidence before change:
- `vendor-documents` was ~491.64 kB raw / 160.60 kB gzip and was on the initial route graph.
- React.lazy application routes were being pulled back into the entry graph by application-level `manualChunks`.

Shipped behavior:
- `manualChunks` now keeps only true vendor families: React, Supabase, icons and documents.
- Application route boundaries are native `React.lazy()` chunks.
- `scripts/performance-chunk-boundary-check.mjs` verifies source and built `dist/index.html`.
- Initial HTML now preloads only React + Supabase + icons; `vendor-documents` remains lazy.
- Initial CSS baseline after B1: `271,767` raw / `46,951` gzip bytes.

Release:
- PR `#88`, PR Web CI `#640`: FULL PASS.
- Production main `d0380e4e087d71db511940e9ecbe0da1bba35fd6`; main Web CI `#641`: FULL PASS.
- Vercel Production `#526`: PASS.
- Deployment `dpl_BR8Bhebd3RsyQ1svaksZoDpyCz1b`: READY, exact SHA, primary alias, `aliasError=null`, live Chrome/evidence PASS.
- Direct production HTML check confirms exactly three initial modulepreloads: vendor React, Supabase and icons.

## PHASE 11 B2 — CSS CRITICAL PATH — ACTIVE

Current branch work:
- Removed eight Garden/HIU Y Quán module-specific stylesheets from `src/main.tsx` global entry.
- Attached the same stylesheets, in preserved cascade order, to lazy `HerbGardenGame.tsx`.
- No game logic, data, RPC, scoring, progression, RBAC or module contract change.
- Performance regression now requires Garden/Y Quán selectors to be absent from initial CSS and present in non-initial lazy CSS assets.

B2 release gate:
1. Require full PR Web CI including build/performance regression/game contracts/real Chrome/viewport matrix.
2. Measure actual initial CSS raw + gzip after build; do not infer savings from source bytes.
3. Squash-merge with exact expected head only after full PASS.
4. Require full main Web CI on exact merge SHA.
5. Require Vercel Production exact SHA READY, primary alias, `aliasError=null`, live Chrome/evidence PASS.
6. Verify primary alias HTML and CSS graph directly before declaring B2 production verified.

## Remaining

- Continue Phase 11 only with measured bottlenecks and bounded batches.
- PHASE 12: final multi-viewport QA and production verification.
