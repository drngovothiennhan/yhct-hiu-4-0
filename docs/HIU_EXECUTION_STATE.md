# HIU YHCT 4.0 — Execution State

Updated: 2026-09-12
Active branch: `hiu-ai-system-health-phase10-20260912`
Base production-verified runtime main: `6b640f46979e64234cc98d357fc7c8b2e6ddbb4f`
Latest main including docs-only Phase 9: `48c46faa931c415fe32ec20ea831d62f3f173dd3`
Production project: `yhct-hiu-final4-stage`
Primary production alias: `yhct-hiu-final4-stage.vercel.app`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 10 — ACC A.I/System Health safe-fix, bounded to the five Phase 9 findings. Runtime changes are on branch only until full PR/main/Vercel gates pass.

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

## PHASE 1 — DONE / PRODUCTION VERIFIED

- ACC compact grouping and scoped Learning Manager capability/UI shipped through PRs `#70`–`#72`.

## PHASE 2 — DONE / PRODUCTION VERIFIED

- Resumable V2 document-to-quiz pipeline shipped through PRs `#73`–`#76`.
- DOCX, UTF-8 TXT and bounded text-layer PDF direct upload preserve source evidence and human approval; no automatic OCR/fabricated source text.

## PHASE 3 — DONE / PRODUCTION VERIFIED

- `/exam` remains canonical with a compact four-experience Learning Hub and preserved server-authoritative exam/session/scoring behavior.

## PHASE 4 — DONE / PRODUCTION VERIFIED

- Home/news compacted and regional weather made privacy-safe/fail-closed.
- Production main `7dd87d73cdd83680da35ea037a8a2ad1ab4585f8`; Web CI `#621`, Vercel `#506`, deployment `dpl_DXvqZ2ASJcG62z3X2VucKZTqMUDD`: PASS/READY/live Chrome.

## PHASE 5 — DONE / PRODUCTION VERIFIED

- Notification unread state is authoritative across the member notification set; direct client table UPDATE was replaced by narrow read-state RPCs.
- Production main `ba7ea8c9d4430ae8fe97cde60a8f70f72d1a58fb`; Web CI `#623`, Vercel `#508`, deployment `dpl_vT5fpHNNKbduuzem79VyQdmRUQw3`: PASS/READY/live Chrome.

## PHASE 6 — DONE / PRODUCTION VERIFIED

- Profile uses real Student Journey metrics and server-authoritative HIU Y Quán title/progression.
- Production main `62a3c75d70d7c934407e813c7ed243cf0fb09f27`; Web CI `#626`, Vercel `#511`, deployment `dpl_6tGZz3PvNRckgSpvGgou9B4Se4tT`: PASS/READY/live Chrome.

## PHASE 7 — DONE / PRODUCTION VERIFIED

- Mobile shell touch targets and Unified AI Mini/bottom-nav fixed-spacing are guarded by real Chrome regression.
- Production main `1a15f824ff285afd5cde6a8a233a4a19bb66a40f`; Web CI `#630`, Vercel `#515`, deployment `dpl_Fx5qpUbns7cPWKVbdkQatBhQdmCA`: PASS/READY/live Chrome.

## PHASE 8 — DONE / PRODUCTION VERIFIED

- Removed only 14 proven-dead CI/release/version artifacts; preserved active version metadata, migrations, runtime/game and current contracts.
- PR `#85`, PR Web CI `#631`: FULL PASS.
- Production main `6b640f46979e64234cc98d357fc7c8b2e6ddbb4f`; main Web CI `#632`: FULL PASS.
- Vercel Production `#517`: PASS.
- Deployment `dpl_BRQcXspDMzmDkQWUWTLGY68Lm9yh`: READY, exact SHA, primary alias, `aliasError=null`, live Chrome/evidence PASS.

## PHASE 9 — DONE / AUDIT MERGED

- Source of truth: `docs/AI_HEALTH_TOP5_2026-09-12.md`.
- PR `#86` merged docs-only to main `48c46faa931c415fe32ec20ea831d62f3f173dd3`; no runtime deployment was required.
- Available production logs did not contain enough real A.I traffic to claim measured request frequency; Frequency was explicitly ranked by static call-path/UI exposure.

Ranked issues:
1. App Assistant lacks normalized success/runtime telemetry — score 80.
2. A.I Operations can present configured readiness as runtime health — score 64.
3. Research internal mode can starve public PubMed/OpenAlex/ClinicalTrials evidence — score 60.
4. ACC Diagnostic bypasses canonical provider policy and has log-schema/metadata-redaction defects — score 50.
5. Static provider registry drifts from the actual Gemini-first runtime — score 48.

## PHASE 10 — ACTIVE

Implemented on branch, not yet production:
- Research leader reserves source budget for public evidence while internal mode is enabled: 2 public + 2 Central RAG + 2 Drive when available, with bounded fill for missing categories.
- XiaoZhi/App Assistant emits normalized success/failure telemetry containing provider/model/route/degraded/failureClass/latency/sourceCount only; no query, prompt, local context or source content.
- ACC Diagnostic uses canonical `/api/ai/diagnostics`, server-side allowlist/redaction, Gemini-first then OpenAI/local fallback, and preserves safe snake_case audit mapping.
- `/api/ai/health` separates provider configuration from liveness/probe and reports Central RAG fail-soft reason.
- ACC A.I Operations labels provider configuration as `CONFIG`, displays live probe separately, and registry is aligned to Gemini primary/OpenAI fallback architecture.
- `scripts/ai-health-phase10-check.mjs` is enforced by `npm run audit:ai-health`, `prebuild`, and an explicit early Web CI step.

## PHASE 10 release gate

1. Open PR from exact frozen Phase 10 head.
2. Require full PR Web CI: AI contracts, build, mobile-shell Chrome, real Chrome, rendered-content, viewport matrix and dist integrity.
3. Squash-merge with expected-head guard only after full PASS.
4. Require full main Web CI on exact merge SHA.
5. Require Vercel Production exact merge SHA READY, primary alias, `aliasError=null`, live Chrome/evidence PASS.
6. Post-release verify `/api/ai/health` truthful configured-vs-live semantics.

## Remaining high-level phases

11. Performance bottlenecks.
12. Final multi-viewport QA and production verification.
