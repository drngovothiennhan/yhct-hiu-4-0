# AI Runtime Handoff v1

## Scope

This release keeps YHCT HIU 4.0 usable when every external AI provider is unavailable. The production order is:

1. Deterministic local knowledge / DRL / extractive RAG.
2. Authenticated `/api/ai/assistant` server gateway for member-only cloud synthesis.
3. Optional Admin Gemini BYOK fallback for the current browser session only.
4. Safe research-link / local degraded response instead of fabricated medical content.

Cloud AI is an enhancement, never a boot dependency.

## Production environment

Server-only variables:

- `ENABLE_CLOUD_AI=true` only after the provider configuration has been verified.
- `OPENAI_API_KEY` must exist only in the Vercel server environment.
- `OPENAI_MODEL` must be a Responses-API model available to the project.

Browser bundles must never contain `OPENAI_API_KEY`. `npm run audit:ai` enforces this.

## Security and medical-safety contract

- `/api/ai/assistant` requires an approved Supabase member session through `current_member_access_v1`.
- Requests are bounded by query/source count and source text size.
- Provider calls have a hard timeout and `store:false`.
- Model output uses a strict JSON schema.
- The model can return only `sourceIds`; the server maps these back to the supplied source whitelist. Model-generated citation URLs are never trusted.
- If no verified source is supplied, the server cannot mark the answer as fully sourced; it returns `needs_source_check` where appropriate.
- Personalized diagnosis or prescribing requests must be redirected to educational guidance (`refuse_clinical_advice`).

## RAG handoff

Research Center retrieval remains local-first. The browser retrieves the top matching local/Drive documents, sends at most six bounded snippets to the server, and receives a structured synthesis. Citations shown in UI are generated from the original retrieved documents, not from arbitrary model text.

## Gemini BYOK

Gemini BYOK is optional and intended for Admin fallback/testing. The key is session-scoped (`sessionStorage`) and legacy persisted key material is purged from `localStorage`. Closing the browser session requires re-entry of the BYOK key.

## Observability

The gateway writes prompt-free structured events to Vercel runtime logs:

- event: `ai_gateway`
- success/failure
- provider
- mode
- member role
- source count
- latency
- failure class

Raw user prompts and source text are not written to these telemetry events.

## Acceptance gates

Before merge/production:

1. `npm run audit:ai`
2. Full `npm run build` (all prebuild gates)
3. Web CI
4. Real Chrome mobile + desktop smoke
5. Vercel deployment state `READY`
6. Vercel runtime errors checked after deployment

## Degraded-mode test

Set `ENABLE_CLOUD_AI=false` in a non-production environment. Expected behavior:

- App loads normally.
- Local YHCT lookup, DRL and extractive RAG still work.
- Cloud gateway responds with `provider=local`, `degraded=true`.
- A.I Mini does not fabricate a cloud answer and redirects users to source checking/research search when needed.

## Incident response

If provider latency/errors increase, set `ENABLE_CLOUD_AI=false` and redeploy. Do not disable the application, Supabase auth, local knowledge base or Research Center. This gives an immediate fail-closed AI rollback while preserving core product functionality.
