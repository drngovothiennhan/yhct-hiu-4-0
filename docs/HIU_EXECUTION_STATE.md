# HIU YHCT 4.0 — Execution State

Updated: 2026-09-12
Active branch: `hiu-phase12-final-qa-20260912`
Base production-verified runtime main: `cfebcb84b85db629660b482cf524896dbd7fbb9c`
Production project: `yhct-hiu-final4-stage`
Primary production alias: `yhct-hiu-final4-stage.vercel.app`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 12 — final multi-viewport QA and production verification. Phase 11 performance work is closed after measured B1/B2/B3 releases; do not reopen it without a new measured bottleneck with clear ownership and a bounded safe batch.

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

## PHASE 11 B2 — GARDEN / HIU Y QUÁN CSS CRITICAL PATH — DONE / PRODUCTION VERIFIED

Shipped behavior:
- Removed eight Garden/HIU Y Quán module-specific stylesheets from `src/main.tsx` global entry.
- Attached the same stylesheets, in preserved cascade order, to lazy `HerbGardenGame.tsx`.
- No game logic, data, RPC, scoring, progression, RBAC or module contract change.
- Performance regression requires Garden/Y Quán selectors to remain absent from initial CSS and present in non-initial lazy CSS assets.

Measured production result:
- Initial CSS: `202,932` raw / `34,292` gzip bytes.
- Initial HTML modulepreloads remain React + Supabase + icons only.
- Garden / HIU Y Quán visual CSS is lazy-loaded and off the initial critical path.

Release:
- PR `#89`: merged.
- Production main `f3532166b5760fef069f9839d0dfe9beaf5b71f0`; main Web CI `#647`: FULL PASS.
- Vercel Production `#532`: PASS.
- Deployment `dpl_C81RnpKfYDvJu4EkgFZ3r6DJCtNt`: READY, exact SHA, primary alias, `aliasError=null`, live Chrome/viewport gates PASS.

## PHASE 11 B3 — RESEARCH CSS CRITICAL PATH — DONE / PRODUCTION VERIFIED

Evidence before change:
- `src/research-ai-upgrade.css` carried ~17.2 kB of Research-only visual payload while being imported from the application entry.
- `ResearchCenter` was already a `React.lazy()` route, so the CSS ownership boundary was measurable and isolated.

Shipped behavior:
- Kept the legacy entry marker payload-free for compatibility.
- Moved the existing Research visual rules behind the lazy Research stylesheet boundary as `research-route-upgrade.css`.
- Added source/dist performance contracts proving moved Research signatures are absent from initial CSS and retained in lazy CSS.
- No Research logic, providers, Gemini/RAG behavior, RBAC, data or user-flow change.

Measured production result:
- Initial CSS reduced from B2 `202.93 kB / 34.29 kB gzip` to `185.97 kB / 31.60 kB gzip`.
- Research lazy CSS is `20.31 kB / 4.20 kB gzip`.
- Initial JS remains stable: app entry `56.73 / 20.27 kB`, icons `52.45 / 10.87 kB`, Supabase `124.40 / 34.35 kB`, React `142.94 / 45.89 kB` raw/gzip.
- Initial HTML remains `4.33 / 1.80 kB` raw/gzip and directly preloads only React + Supabase + icons.
- Approximate initial directly referenced payload after B3 is ~`144.78 kB gzip` including HTML, CSS and initial/preloaded JS.

Release:
- PR `#90`, PR Web CI `#649`: FULL PASS.
- Production main `cfebcb84b85db629660b482cf524896dbd7fbb9c`; main Web CI `#650`: FULL PASS.
- Vercel Production `#535`: PASS.
- Deployment `dpl_DJqwnhuiihEcTGXkLLtSWQWa6hKT`: READY, exact SHA, primary alias, `aliasError=null`.
- Live Google Chrome production smoke passed on `390x844` mobile and `1440x1000` desktop.
- Direct primary-alias HTML verification confirms exactly three initial modulepreloads: React, Supabase and icons, with `index-JQfc_xaH.css` as the sole initial stylesheet.

## PHASE 11 CLOSURE — MEASURED AUDIT

- B1 removed the document vendor family from the initial preload graph.
- B2 removed the largest proven module-specific CSS family (Garden / HIU Y Quán) from initial CSS.
- B3 removed the next clear, safely owned Research-only visual payload from initial CSS.
- Remaining entry CSS is predominantly default-feed, shell, theme, viewport and shared compatibility styling used on first render or across modules.
- The default `/feed` route intentionally mounts both `StudentHome` and `AcademicFeed`, so feed/community CSS is not an off-route payload at boot.
- Remaining clearly route-specific entry styles are either small (for example `exam-v2.css` is ~1.38 kB source) or mixed/shared; no further Phase 11 batch is justified without new measured evidence.
- PHASE 11 is therefore CLOSED. Do not optimize further by filename or intuition alone.

## PHASE 12 — FINAL MULTI-VIEWPORT QA + PRODUCTION VERIFICATION — ACTIVE

Release objective:
- No feature/refactor scope. This phase verifies the production state and records the final checkpoint.
- Existing Web CI remains authoritative for build, contracts, real Chrome regression and viewport matrix.
- Existing Vercel Production workflow remains authoritative for exact-CI-SHA deployment, READY state, primary alias binding and live Chrome production smoke.

Final gates:
1. Full PR Web CI PASS on the Phase 12 checkpoint branch.
2. Merge only after PR PASS; record exact merge SHA.
3. Full main Web CI PASS on that exact merge SHA.
4. Vercel Production must deploy that exact SHA, reach READY, bind `yhct-hiu-final4-stage.vercel.app`, and report `aliasError=null`.
5. Live Google Chrome production smoke must pass on mobile `390x844` and desktop `1440x1000`.
6. Confirm initial modulepreload remains React + Supabase + icons and no performance boundary regresses.
7. No business logic, RBAC, data, quiz approval, AI contracts or game progression changes are permitted in Phase 12.

## Remaining

- Complete the Phase 12 checkpoint PR through all release gates above.
- After exact-SHA production and live Chrome verification, mark PHASE 12 DONE / PRODUCTION VERIFIED and use that main SHA as the next execution baseline.
