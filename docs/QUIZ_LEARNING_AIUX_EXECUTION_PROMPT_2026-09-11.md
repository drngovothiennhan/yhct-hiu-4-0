# HIU YHCT 4.0 — QUIZ → LEARNING + A.I MINI UX EXECUTION PROMPT

Status: executable implementation contract. Canonical A.I architecture remains governed by `AI_CANONICAL_ARCHITECTURE_2026-09-11.md`.

## ROLE
Act as Principal Full-Stack Engineer, AI Product Architect, Learning Systems Engineer, Release Engineer and QA Lead for `drngovothiennhan/yhct-hiu-4-0`.

## OUTCOME
Finish one closed learning pipeline without adding a new chatbot or provider:

`Drive/DOCX SOURCE → deterministic extraction → Gemini Quiz Designer only when needed → admin draft/review → approved published practice_questions → Quick Review 5/10/20 → continuous Practice Quiz → scoring/review`.

A.I Mini remains the single application-assistant launcher. Research A.I remains only in Research Center.

## HARD RULES
1. Never invent answer/evidence outside SOURCE. Gemini question requires exactly four unique options, one answer, explanation and literal evidence contained in SOURCE.
2. AI-generated questions remain draft until an admin explicitly confirms them. One explicit ACC confirmation is sufficient; do not force a redundant second moderation pass after the same admin has reviewed evidence.
3. Only `source_verified` or `expert_approved` questions may be served to students. Rejected/needs-review rows never enter Quick Review or Practice Quiz.
4. Reuse `practice_questions` as the canonical approved learning bank. Do not create a competing question bank.
5. Quick Review offers exactly 5 / 10 / 20 questions before today's session is created. The selected daily set remains stable across reloads.
6. Practice Quiz is Google-Quiz-like, mobile-first, uses the same approved bank, supports subject filtering, continuous paging / no fixed 50-question product limit, submit/review, and never exposes correct answers before submit.
7. Do not weaken RBAC, Drive consent, evidence, provenance, or CI gates. Provider secrets remain server-side.
8. Do not add a Vercel Serverless Function. Keep current route budget.
9. A.I Mini introduction is compact/collapsible. Shortcut actions stay visible. Avatar is presentation-only and user-selectable; it must not create a separate A.I architecture.
10. Traditional-Vietnam/eagle visual is an original friendly mascot treatment, not a copy of a protected logo.

## IMPLEMENTATION
### ACC
- Improve `auto` conversion: deterministic parser wins only when it has importable/answer-backed questions. If a document has no usable MCQ structure, fall through to Gemini Quiz Designer.
- Make the primary CTA explicit: `Tự chuyển đổi` / `Cập nhật vào ngân hàng`.
- Preserve source text, evidence, model/generator, source file/folder, admin identity and approval timestamp.
- Bulk sync always creates drafts, never silently imports.
- Fix DB ingest so an AI question sent by the admin-gated commit path with `provenance.adminConfirmed=true` may persist directly as `expert_approved`, with verifier identity/timestamp. Any other AI path remains `needs_review`.

### QUICK REVIEW
- Use approved `practice_questions` only.
- UI selector: 5, 10, 20.
- Create the daily stable session using the selected count; after creation display the locked count rather than pretending it can be changed.

### PRACTICE QUIZ
- Add server-authoritative RPCs over `practice_questions`, not `exam_questions_v2`.
- Configuration returns approved count and subjects.
- A page RPC returns question text/options only; no correct index/explanation.
- A submit RPC accepts selected answers for the currently loaded approved question IDs and returns score + review. Bound each request for abuse protection; the UI can continuously load additional pages so the product has no fixed 50-question ceiling.
- UI resembles a clean one-column Google Quiz: subject filter, progress, radio options, load-more, submit, score/review.

### A.I MINI UX
- Replace long role explanation with one short sentence.
- Guidance panel can collapse/auto-hide and persists its display preference locally.
- Keep shortcuts: Điểm rèn luyện, Tín dụng, Thông báo, Tin HIU/YHCT, Tin hôm nay, Lịch CLB.
- Add avatar preference with four presentation variants: default, eagle-inspired, Vietnamese-traditional, minimal. Same routing/text/voice contract for all variants.

## CONTRACTS
Add or update tests proving:
- auto conversion fallback behavior;
- SOURCE-backed evidence and four-option invariant;
- no AI import without explicit admin confirmation;
- admin-confirmed AI import becomes approved once, not a redundant second review;
- student APIs expose approved bank only;
- daily selector is exactly 5/10/20 and session remains stable;
- continuous Practice Quiz has no fixed 50-question product limit and does not leak answers before submit;
- A.I Mini compact guidance is collapsible and avatar changes are presentation-only;
- no extra serverless route / no secret client storage.

## RELEASE GATE
Run, in order:
`npm run audit:ai`
`npm run audit:ai-roles`
`npm run audit:rag`
`node scripts/v22-quiz-import-check.mjs`
`npm run audit:v11`
`npm run build`
then full Web CI, real Chrome responsive smoke and viewport matrix.

Apply the Supabase migration only after static/contract gates prove the SQL contract. Merge only a green PR. Production deploy only from the green main SHA, then verify health, ACC, Quick Review, Practice Quiz, A.I Mini and runtime errors.

## STOP CONDITION
When this pipeline is green in production, stop AI/quiz refactoring. A new cycle requires a concrete user use case and acceptance criteria.