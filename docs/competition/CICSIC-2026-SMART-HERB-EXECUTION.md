# CICSIC 2026 — YHCT Connect × Smart Herb Execution

## Non-break baseline
- Branch: `competition/smart-herb-v1`
- Draft PR: #20
- Production `main` is not merged until all release gates pass.
- Smart Herb is an isolated public route: `/smart-herb?herb=<slug>`.
- Existing application routes and existing production tables are not replaced.
- The Smart Herb page has a static evidence-backed fallback if Supabase is temporarily unavailable.

## Competition product
**YHCT Connect × Smart Herb** — a free phygital learning experience: physical herb sample → QR → academic profile → PubMed evidence → safety → quiz → YHCT Connect community.

Product principles: **Near · Simple · Free**.

## Current MVP
- Public guest access without login.
- Responsive mobile/desktop herb profile.
- QR-ready deep link.
- Searchable catalog.
- Evidence/safety sections.
- PubMed source links.
- Micro-quiz.
- Supabase table `public.smart_herbs` with public read-only RLS.
- Initial demo herbs: Đương quy, Sinh khương, Cam thảo.

## Release gates
1. TypeScript/Vite production build succeeds.
2. Existing acceptance/platform checks succeed.
3. Existing real Google Chrome responsive smoke succeeds.
4. Dedicated Smart Herb Chrome smoke succeeds at 390×844 and 1440×1000.
5. Guest deep link `/smart-herb?herb=duong-quy` works after hard refresh.
6. No horizontal overflow on mobile.
7. PubMed sources are clickable and match the intended herb/evidence wording.
8. Medical-safety statement remains visible: educational only; not diagnosis/treatment.
9. Supabase `smart_herbs` remains read-only for anon/authenticated roles.
10. Security advisor shows no new Smart Herb-specific warning.

## Timeline with test buffer
- **08–10/09:** MVP code, database, evidence links, QR flow.
- **11/09:** expand to 10–20 competition herbs only after source review.
- **12/09:** feature freeze for submission build; no scope expansion after freeze.
- **13–14/09:** dedicated QA buffer: mobile/desktop, deep links, QR prints, academic/medical review, pitch-demo rehearsal.
- **15/09:** submission buffer only; no risky architecture changes.

## Evidence policy
- Do not present preclinical mechanisms as proven clinical efficacy.
- Do not claim diagnosis, prescription, or therapeutic replacement.
- Every modern-evidence statement used in the competition demo must have a traceable source.
- Mark evidence level explicitly and keep uncertainty visible.

## Merge rule
Merge PR #20 only after automated CI + dedicated Smart Herb Chrome QA + manual competition demo review are all complete. Until then, production behavior stays intact.
