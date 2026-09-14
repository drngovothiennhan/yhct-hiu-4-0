# HIU YHCT 4.0 — Phase 19 Study OS / Research AI architecture

## Product rule reset

Phase 19 intentionally stops expanding overlapping workflows. New work must converge on one canonical path per user goal.

### Quiz bank — one canonical path

`Drive / NGÂN HÀNG TRẮC NGHIỆM / Thêm thủ công` → Admin `Cập nhật` → scan direct DOCX files and DOCX files inside one immediate subject folder → process new, changed, or parser-revision-pending sources → accept only questions with four A–D choices and exactly one Word red-font answer → publish valid questions immediately.

File names are provenance for administrators only. They are not member subjects and are not returned by the member quiz-page RPC. Immediate folder names are the member-facing subject taxonomy. Invalid questions/files never block valid data. Unchanged ready sources are not rescanned; changed/nonready sources may be retried deterministically by the current parser revision.

## Execution discipline lock

1. Do not create extra phases, features, code paths, interactions, or scope beyond accepted requirements merely to increase coding or conversation turns.
2. Before changing code, analyze the failure and select the smallest production-safe change that fixes the root cause while reusing stable existing architecture.
3. Do not rebuild completed phases or reintroduce parallel workflows when an existing canonical path can satisfy the requirement.
4. Prefer deterministic source-grounded processing over AI inference whenever source data already contains an authoritative answer or state.
5. Declare handover only after data reconciliation, full PR and main CI, exact-SHA production READY, and production smoke/release gates are verified.

## Five Research Center UI directions

1. **One inline AI workbench, no floating duplicate.** Gemini Research is placed directly after the Research hero and before evidence/RAG utilities. Mobile never opens a second full-height assistant over the page.
2. **Task-first instead of provider-first.** The workbench exposes Bằng chứng, PICO, Khoảng trống, Phương pháp, and Dịch. Users choose the research job, not an AI vendor.
3. **Evidence and AI are separate layers.** PubMed/OpenAlex/ClinicalTrials results remain visible and independently verifiable even if Gemini is unavailable.
4. **Internal data is a utility with explicit consent.** Local/Drive material is managed in a document workspace. Sending internal context to Gemini requires a per-request opt-in.
5. **Outputs end in actions.** Research results can become a proposal workflow; proposal generation exposes its real quota and exports a Word artifact only after the user reviews the content.

## Five AI-maximization directions

1. **Gemini Research is the medical-research leader.** It receives a research-specific task contract, not a generic chat persona.
2. **Retrieval workers precede synthesis.** PubMed, OpenAlex, and ClinicalTrials.gov are queried before synthesis; internal Drive/Central RAG is added only with consent.
3. **Evidence-bound generation.** Empirical claims must be tied to retrieved source IDs. When evidence is insufficient, the required output is uncertainty — never fabricated detail.
4. **Specialized reasoning workflows.** PICO/PICOS, evidence synthesis, research-gap analysis, and methodology design have different task instructions and failure rules.
5. **Cost and quota are server-authoritative.** Research-proposal generation uses Gemini Research with 3 requests per approved member per 6-hour window. Guests receive zero Gemini proposal generations. No local pseudo-AI draft is substituted after provider failure.

## App-wide Study OS audit

### Current strengths to preserve

- `StudyHubV2` is the canonical Home learning surface.
- Gemini Study already shares the existing assistant gateway rather than adding another Vercel function.
- XiaoZhi/AI Mini is bounded to navigation/task execution instead of academic answering.
- Research public retrieval has independent PubMed/OpenAlex/ClinicalTrials providers.
- Server-authoritative quiz sessions/grading and source provenance already exist.
- HIU Y Quán V20 and Garden are lazy-loaded and isolated from academic AI generation.
- PWA release, CI, viewport, and exact-SHA production gates are already established.

### Change candidates recorded

1. **Research legacy presentation code:** old floating/panel CSS and dormant local-answer helpers remain as compatibility code. Runtime no longer uses them for Research answers. Consolidate/dead-code-delete only in a later cleanup after Phase 19 production telemetry is stable.
2. **Legacy quiz conversion pipeline:** backend compatibility remains, but ACC no longer exposes it as the canonical bank-ingestion workflow. Do not reintroduce DOCX/TXT/PDF multi-step conversion into the main bank Update path.
3. **Scattered client persistence:** Student Journey, adaptive review, local RAG, and UI preferences use separate local stores. Future Study OS work should expose one learner-state contract rather than cross-reading localStorage keys.
4. **Multiple historical UI/CSS generations:** several legacy styles are still shipped for backward compatibility. New features must use the canonical surface and must not add another parallel stylesheet stack.
5. **AI observability:** provider configured/live/degraded states exist but should become a single operational health contract shared by Study and Research, without showing provider internals as student-facing product choices.
6. **Learning orchestration:** Study Home has daily focus/review, but assignments, quiz weakness, saved research, and calendar context are not yet one next-best-action engine.
7. **Research artifacts:** proposal Word export exists; future artifacts should share a citation/evidence ledger so claims stay traceable across notes, proposals, and study summaries.

## Minimum standard for a real Study OS

A feature qualifies as part of Study OS only if it follows these invariants:

1. **One learner state:** progress, weak topics, goals, review queue, and active context have one authoritative contract.
2. **One intent router:** study question → Gemini Study; research question → Research Center; app action/navigation → task assistant. No assistant competes for the same intent.
3. **Context before generation:** AI receives the smallest relevant study/research context and never silently reads private Drive material.
4. **Evidence before confidence:** factual research answers expose sources; lack of evidence lowers confidence instead of producing fluent filler.
5. **Actionable output:** every major AI result offers a next learning action: quiz, review, save evidence, open source, create proposal, or schedule work.
6. **Server-authoritative limits and grading:** quotas, access, scoring, publication, and sensitive state cannot be reset or forged from the browser.
7. **Truthful degraded mode:** a failed cloud model is reported as unavailable. Deterministic utilities may continue but must never masquerade as AI answers.
8. **Progressive disclosure:** mobile shows the current task first; advanced controls appear only when needed.
9. **No duplicate workflow:** a goal has one canonical UI and one canonical backend path. Compatibility code may remain temporarily but cannot be user-addressable.
10. **Production proof:** every architecture rule is represented by an automated contract and must pass build, Chrome viewport, main CI, and exact-SHA Vercel production gates.

## Phase 19 release gates

- Quiz Update scans direct DOCX children of `Thêm thủ công` plus DOCX files in one immediate subject-folder level, retrying only new, changed, or nonready/parser-revision-pending sources.
- Trusted bank accepts only Word red-font answer evidence; valid questions publish immediately.
- Member quiz RPC never returns `sourceFileName` and does not depend on file/folder registry for eligibility.
- Research workbench has no `buildAcademicFallback` path.
- Research proposal endpoint uses Gemini Research and DB quota RPC; no OpenAI/local fallback.
- Guest proposal calls fail at member access before quota/provider execution.
- Vercel function count remains within Hobby limit; no new API route is created.
