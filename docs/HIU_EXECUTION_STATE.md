# HIU YHCT 4.0 — Execution State

Updated: 2026-09-12
Active branch: `hiu-ai-health-phase9-20260912`
Base production-verified main: `6b640f46979e64234cc98d357fc7c8b2e6ddbb4f`
Production project: `yhct-hiu-final4-stage`
Primary production alias: `yhct-hiu-final4-stage.vercel.app`
Supabase production: `gzmpnsrwqjpsbklyflqr` — ACTIVE_HEALTHY

## Current phase

PHASE 9 — Top-5 A.I health audit by Impact × Frequency × Risk. Audit/report only; runtime safe-fixes start in Phase 10.

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

## PHASE 9 — AUDIT COMPLETE / REPORT PENDING MERGE

Source of truth: `docs/AI_HEALTH_TOP5_2026-09-12.md`.

Scoring uses `Impact × Frequency × Risk` on 1–5 scales. Available production logs do not contain enough real A.I request traffic to claim measured request frequency; Frequency is explicitly treated as static call-path/UI exposure.

Ranked issues:
1. App Assistant lacks normalized success/runtime telemetry — score 80.
2. A.I Operations can present configured readiness as runtime health — score 64.
3. Research internal mode can starve public PubMed/OpenAlex/ClinicalTrials evidence — score 60.
4. ACC Diagnostic bypasses canonical provider policy and has log-schema/metadata-redaction defects — score 50.
5. Static provider registry drifts from the actual Gemini-first runtime — score 48.

No runtime/data/schema behavior was changed in Phase 9.

## PHASE 10 — NEXT

ACC A.I/System Health safe-fix, bounded to the five audited issues:
- focused regression contracts first;
- preserve public evidence budget when internal Research context is enabled;
- normalize/redact ACC Diagnostic payload and reuse canonical provider policy primitives;
- add privacy-safe App Assistant telemetry;
- separate configured readiness from live/probed state and align provider registry/A.I Operations with runtime truth;
- full AI/RAG/build/Chrome/exact-SHA production gates before completion.

## Remaining high-level phases

11. Performance bottlenecks.
12. Final multi-viewport QA and production verification.
