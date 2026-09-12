# HIU YHCT 4.0 — PHASE 16 MASTER EXECUTION PROMPT

## TRUSTED QUIZ INGESTION + APPROVED DRIVE SYNC + AI CHAT UX

Production baseline: `b9ee4a27575cb765dd216a53475b008bfa33cfd7`.

Work on the existing production system. Do not rebuild stable modules and do not weaken authentication, Supabase RLS/RBAC, server-authoritative grading, Research provenance, Central RAG, XiaoZhi, HIU Y Quán, Knowledge Gateway, Publish Center, or exact-SHA CI/Vercel release discipline.

### 1. Canonical approved quiz-document contract

The canonical source format is a DOCX containing numbered questions and exactly four options A–D. The correct option is marked in Word with red font color. Golden fixture validated on 2026-09-12: 81 questions, 81/81 with exactly one completely red A–D option, direct Word color `FF0000`.

Trusted auto-import is allowed only when ALL conditions hold:
- source is uploaded directly by an authorized Learning Content Manager/Admin OR comes from the configured approved-outline Drive folder;
- file is DOCX and passes file/ZIP expansion limits;
- every imported question has a valid stem and exactly four non-empty distinct A–D options;
- exactly one option is deterministically marked red by the DOCX formatting parser;
- source hash, source file identity, marker format/version, question number and marked answer are retained in provenance;
- no AI model is used to infer or repair the answer.

If an item has no red option, multiple red options, malformed options, unsupported formatting, or ambiguous structure, DO NOT guess and DO NOT publish that item automatically. Keep it out of the trusted bank and return an explicit validation result.

Trusted marked questions enter the runtime bank as source-verified content and are immediately eligible for student practice. AI-generated questions remain `needs_review` and keep the existing human-review workflow.

### 2. Approved Drive folder sync

Provide a dedicated approved-outline folder root (`YHCT_DRIVE_APPROVED_OUTLINE_FOLDER_ID`, with safe compatibility fallback only where explicitly intended).

When an authorized admin presses Update:
- list DOCX files using Drive `createdTime` (not only modified time);
- prioritize newly created files;
- compare file IDs against the server-side synchronized-source registry so previously imported files are skipped without reprocessing;
- process bounded batches to protect Vercel runtime;
- parse the red marker deterministically;
- import valid trusted questions directly into the practice bank;
- retain source hash and audit provenance;
- report imported / skipped / invalid / review-needed counts.

The operation must be idempotent. Re-running Update must not duplicate questions.

### 3. Answer-check requests

Students must have a lightweight “Yêu cầu kiểm tra đáp án” action after grading. A request creates an auditable review ticket linked to the canonical question and member. It must NOT let the student alter the correct answer and must NOT automatically deactivate the question from a single report.

Learning Content Managers/Admins receive a bounded review queue. Existing review/approval functions remain authoritative for any correction or rejection.

### 4. AI assistant UX

AI Mini is a compact application assistant, not a marketing/intro surface:
- remove/hide long assistant introductions and oversized suggestion panels;
- keep suggestions in one compact horizontal row with overflow/auto-scroll behavior;
- prioritize the conversation transcript and composer;
- preserve stop/cancel, voice, XiaoZhi routing and session safety.

The primary AI icon opens a dedicated `/ai` module with a professional full-page chatbot:
- transcript-first layout;
- compact horizontal suggested actions;
- persistent composer at the bottom of the AI workspace;
- new conversation / stop action;
- source rendering from the existing XiaoZhi/Gemini/RAG contract;
- no provider implementation jargon in ordinary student UI.

Research AI remains a separate evidence workflow; do not collapse Research into ordinary chat.

### 5. Security and integrity invariants

- Never infer a medical quiz answer from AI for trusted auto-import.
- Never expose raw Drive IDs or provider credentials to students.
- All privileged ingestion/sync operations require the existing learning-content capability.
- New SECURITY DEFINER functions must set an empty search_path, explicitly check the current member/capability, revoke PUBLIC/anon execute, and grant only authenticated when appropriate.
- Preserve exact source revision/hash integrity.
- Preserve server-side grading and do not expose correct_index before submission.
- Source changes must not silently inherit stale approval.

### 6. Required verification gates

Add Phase 16 contract tests to prebuild and CI covering:
- deterministic DOCX red-marker parser;
- exactly-one-red requirement;
- trusted-source boundary;
- no AI answer inference;
- createdTime Drive ordering and existing-file skip contract;
- idempotent import provenance;
- answer-review request authorization;
- `/ai` dedicated module and compact AI Mini UX;
- existing quiz integrity and server grading unchanged.

Release only after:
1. PR exact-head Web CI full pass;
2. schema migration applied and verified if required;
3. PR merged with exact main SHA;
4. main Web CI full pass;
5. Vercel production deployment for exact SHA is READY with primary alias and `aliasError=null`;
6. live browser checks for Home, AI Center, Exam/quiz, Admin/Publish Center and profile routes;
7. protected APIs remain fail-closed when unauthenticated and runtime logs show no new 5xx.

Do not declare Phase 16 complete before all gates are satisfied.
