# V11 Architecture Decision — Drive → Daily Practice

## Considered approaches

1. **Live Drive RAG per student request** — read DOCX from Drive whenever a student starts practice. Lowest setup cost, but slow, quota-sensitive, difficult to make deterministic, and unsuitable as a runtime source of truth.
2. **Scheduled/bounded ingestion into Supabase (selected)** — Drive remains the authorized source repository; DOCX is extracted with Mammoth, explicit MCQs are parsed deterministically, study text can be converted through strict structured A.I output, all generated questions keep provenance and require review, then approved questions are stored in Supabase for stable daily sessions.
3. **Drive Changes webhook + queue/event pipeline** — best real-time enterprise architecture, but needs OAuth change channels, queue/worker operations, retry/dead-letter infrastructure and more operational cost than the current student platform needs.

## Decision

Use approach 2 now. It reuses the existing Drive API and Mammoth dependency, minimizes runtime latency and cost, keeps questions reproducible, supports source traceability, and fails closed when Drive or A.I is unavailable. The schema and ingestion boundary are designed so approach 3 can replace the trigger later without changing the student-facing daily-practice contract.

## Safety/integrity contract

- No Drive read occurs when a student simply opens today's practice.
- `source_verified` is reserved for deterministically parsed questions whose answer is explicitly present in the source DOCX.
- A.I-generated questions are always `needs_review`; moderators must approve before students can receive them.
- Daily question selection is server-authoritative and stable for member + Vietnam calendar date.
- Correct answers are not returned in the daily-session payload; they are revealed only after a submitted answer.
