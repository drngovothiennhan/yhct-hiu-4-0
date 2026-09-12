# HIU YHCT 4.0 — Top-5 A.I Health Issues

Date: 2026-09-12
Audit base: production-verified `main` `6b640f46979e64234cc98d357fc7c8b2e6ddbb4f`
Canonical architecture: `docs/AI_CANONICAL_ARCHITECTURE_2026-09-11.md`

## Method

Priority score = `Impact × Frequency × Risk`, each dimension 1–5.

- Impact: 1 cosmetic → 5 core product/privacy/accuracy impact.
- Frequency: 1 dormant → 2 incident/admin-triggered → 3 scoped feature path → 4 recurring feature/admin path → 5 core A.I request path.
- Risk: 1 cosmetic → 5 privacy/security/incorrect-decision exposure.

Production runtime logs in the available 24-hour retention window contain release/health traffic but no meaningful `ai_gateway` or `xiaozhi_mini` request sample. Frequency below is therefore **static exposure**, not a fabricated observed request rate. Each item is explicitly classified by evidence type.

## Ranked Top-5

| Rank | Issue | Impact | Frequency | Risk | Score | Evidence |
|---|---|---:|---:|---:|---:|---|
| 1 | App Assistant lacks success/runtime telemetry | 4 | 5 | 4 | **80** | static core-path |
| 2 | A.I Operations can show configuration readiness as runtime health | 4 | 4 | 4 | **64** | static + live `/api/ai/health` |
| 3 | Research internal mode can starve public evidence | 5 | 3 | 4 | **60** | static functional path |
| 4 | ACC Diagnostic bypasses canonical provider policy and loses/redacts context incorrectly | 5 | 2 | 5 | **50** | static admin path |
| 5 | Provider registry truth drifts from actual Gemini-first runtime | 4 | 4 | 3 | **48** | static + live health mismatch |

## 1. App Assistant lacks success/runtime telemetry — 80

### Evidence

`api/_lib/xiaozhi-mini-handler.js` is the canonical server runtime for A.I Mini/XiaoZhi. Successful Gemini/public/direct/local responses return provider and latency to the client, but the server does not emit a normalized success event containing route/provider/degraded/latency. The visible structured `xiaozhi_mini` server log is emitted on Gemini failure, not on every completed request.

The 24-hour production log query for `ai_gateway` and `xiaozhi_mini` returned no usable request sample. This cannot be interpreted as zero usage; the runtime path itself does not provide the complete success telemetry needed to calculate latency, degraded rate or route accuracy.

### Consequence

ACC cannot truthfully answer the operational questions already promised by the canonical roadmap: real latency, provider failure rate, degraded rate and route outcome for the main A.I entry point. Incidents can remain invisible while configuration appears healthy.

### Phase 10 acceptance

- Emit one normalized telemetry event for each completed App Assistant server request.
- Allowed fields only: event, ok, provider, model category/non-secret model name, route, degraded, failureClass, latencyMs, sourceCount/toolCount where applicable.
- Never log query text, conversation text, internal document text, secret, token or personal data.
- Add regression coverage proving both success and failure telemetry shapes contain no prompt/private payload.

## 2. A.I Operations reports configured readiness as runtime health — 64

### Evidence

`api/ai/health.js` derives `providers.openai` and `providers.gemini` primarily from configuration helpers. It does not make a live provider request on GET. Several capability flags are advertised as constant `true`. Central RAG errors are collapsed to `centralRagReady=false` by a silent catch without a failure reason.

`src/components/admin/AiOperationsPanel.tsx` labels the surface as monitoring `readiness · model/provider · latency · degraded mode · privacy gate · contract`, but its recurring 60-second refresh exposes configuration/capability state, not actual latency/degraded/failure metrics. The only explicit live provider probe exposed in the panel is Gemini; there is no equivalent OpenAI liveness probe.

Production `/api/ai/health` currently returns both providers configured and Central RAG ready. That is useful configuration evidence, but it is not equivalent to provider liveness.

### Consequence

Admin can receive a false-green operational impression when credentials/models are configured but a provider is rate-limited, inaccessible, slow or failing.

### Phase 10 acceptance

- Separate `configured` from `live/probed` semantics in API and UI.
- Do not label configuration snapshot as live health.
- Provide bounded admin-only live probe coverage for configured cloud providers, or explicitly mark provider as `not_probed`.
- Expose failure reason class for RAG/provider checks without exposing secrets.
- ACC must not claim latency/degraded monitoring unless backed by actual telemetry data.

## 3. Research internal mode can starve public evidence — 60

### Evidence

`src/components/research/ResearchAiMini.tsx` retrieves public PubMed/OpenAlex/ClinicalTrials evidence and, when internal mode is enabled, Central RAG + Drive. It then creates:

`const sources=[...knowledge,...drive.sources,...literature].slice(0,6)`

`centralSources()` can contribute up to five items, while Drive can contribute additional items. Therefore a successful internal retrieval can consume all six source slots before PubMed/OpenAlex/ClinicalTrials literature reaches the Research leader.

This conflicts with the product requirement displayed to users and canonical architecture: internal documents are optional context to be **cross-checked against public academic evidence**, not a replacement for it.

### Consequence

A user who explicitly enables internal documents can paradoxically receive a less externally grounded synthesis. This is an answer-quality/provenance defect on the research path.

### Phase 10 acceptance

- Use an explicit bounded source budget that reserves public academic evidence when internal mode is enabled.
- Minimum target when available: at least two public academic sources plus bounded Central/Drive sources within the six-source gateway limit.
- Deduplicate before truncation.
- Add a contract test where Central + Drive both return enough items and prove public PubMed/OpenAlex/ClinicalTrials evidence remains in the final source set.

## 4. ACC Diagnostic bypasses canonical provider policy and has a log-schema/privacy defect — 50

### Evidence

`src/components/admin/SystemAdminCenter.tsx` sends audit rows shaped with `entity_type`, `entity_id`, and `created_at` to the Supabase Edge Function `acc-diagnostics`.

`supabase/functions/acc-diagnostics/index.ts` reads `row.entity` and `row.createdAt`, so entity/timestamp context from the caller is lost. It also forwards the `metadata` object into the diagnostic prompt without a field-level allowlist/redaction policy.

The Edge Function calls `https://api.openai.com/v1/responses` directly instead of reusing the canonical A.I provider/policy primitives. This bypasses the architecture rule that common policy must cover privacy, timeout, provider selection, telemetry and error normalization.

### Consequence

Diagnostic quality is weakened by missing entity/time context, while arbitrary audit metadata can be sent to an external provider through a separate policy path. The path is Admin-triggered, so frequency is lower, but privacy/security risk is high.

### Phase 10 acceptance

- Normalize caller/Edge Function log schema (`entity_type`, `entity_id`, `created_at`) explicitly.
- Allowlist diagnostic metadata fields; never forward arbitrary raw metadata, tokens, prompts, content bodies or secrets.
- Reuse the canonical server provider/policy primitive or a shared safe diagnostic provider helper rather than a separate unmanaged direct call.
- Keep admin authorization and local deterministic fallback.
- Add a contract test with intentionally sensitive metadata keys proving they are removed before any provider payload is built.

## 5. Provider registry truth drifts from Gemini-first runtime — 48

### Evidence

`src/modules/ai/providers/registry.ts` marks OpenAI as `active` and `gemini-server` as `optional`.

The canonical architecture and actual runtime are Gemini-first. Production `/api/ai/health` currently reports both providers configured, `academicProviderPriority="gemini-first"`, `defaultSearchProvider="gemini-google-search"`, fast Gemini `gemini-3.5-flash-lite`, and Research Gemini `gemini-3.8-flash`.

`AiOperationsPanel` mixes this static registry (`activeAiProviders()`) with live health, so the Admin view can simultaneously say Gemini is the preferred configured provider while excluding `gemini-server` from the static active-provider count/list.

### Consequence

The operational dashboard contains contradictory truths, increasing the chance of unnecessary configuration changes or incorrect incident diagnosis.

### Phase 10 acceptance

- Static registry describes implemented capability only, not runtime readiness.
- Runtime status/badge must come from live health/probe data.
- Gemini-first/OpenAI-fallback strategy must be represented consistently with canonical architecture.
- Add a regression test preventing static provider state from contradicting the canonical provider strategy.

## Cross-cutting contract gap

Current `ai-runtime-check.mjs` and `ai-role-contract-check.mjs` strongly protect role boundaries, internal-context consent, citation validation, Gemini-first routing and anti-sprawl. They do **not** currently lock:

- App Assistant success telemetry privacy/schema;
- configured-vs-live health semantics;
- balanced public/internal Research source budget;
- ACC Diagnostic metadata redaction/schema mapping;
- provider-registry consistency with canonical strategy.

Phase 10 must add focused contracts for these five gaps before any production merge.

## Watchlist — not promoted into Top-5

- Client and server currently duplicate the Research intent regex. They match today and sample contract tests pass, but this is a future drift risk; centralization is desirable only if it can be done without destabilizing the current deterministic router.
- `academicAiService.askAcademicUnified()` routes public-only academic requests through XiaoZhi, but no active call site was established in this audit; treat as a dead/dormant-code candidate, not a production defect until reachability is proven.
- Central RAG health uses fixed content-count thresholds and suppresses underlying errors. The operational ambiguity is covered under issue #2; avoid creating a second overlapping fix.

## Phase 10 order

1. Lock focused regression contracts for the five issues.
2. Fix Research source budgeting and diagnostics redaction/schema first because they affect answer provenance/privacy.
3. Add privacy-safe App Assistant telemetry and distinguish configured vs live health.
4. Align provider registry/A.I Operations with live truth.
5. Run existing AI role/runtime/RAG contracts, full build, Chrome QA and exact-SHA production release gate.
