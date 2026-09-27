# Study OS personalization v1

## Scope

This feature personalizes the Study OS home page from that member's saved lesson progress and quiz history. It does not generate clinical advice or quiz content. The summary and recommendation are deterministic queries over reviewed learning records.

## Data model

The implementation reuses existing quiz data:

- `public.daily_practice_question_stats`: `member_id`, `question_id`, `attempts`, `correct_count`, `wrong_count`, `last_seen_at`.
- `public.daily_study_review_questions_v1` and `public.daily_study_review_sets_v1`: answered questions from the daily grounded review, joined to their canonical `practice_questions` row for subject and topic.
- `public.practice_questions` and `public.practice_source_documents`: reviewed source question metadata and the verified source document used for a recommendation.

New table:

| Column | Purpose |
|---|---|
| `member_id`, `lesson_id` | One progress row per member and supported lesson. V1 accepts only `tcm-herbs-formulas-v1`. |
| `status` | `in_progress` or `completed`. Completion is recorded when all 20 lesson quiz answers have been submitted. |
| `last_section_id` | Last visible lesson section, flashcards, or quiz. |
| `progress_pct` | Furthest observed section, capped at 95 until quiz submission; then 100. |
| `active_seconds` | Approximate visible time in the lesson, added in 30-second visibility ticks. |
| `started_at`, `last_activity_at`, `completed_at` | Lesson start, latest recorded activity, and completion time. |

The progress table is in the exposed `public` schema with RLS enabled and no direct client table grants. Three authenticated RPCs use `private.current_member_id()` and `private.is_approved()`; clients never supply another member's ID. The summary RPC returns only that member's topic aggregates, source document metadata, lesson progress, and next action.

## Recommendation rules

Evaluate in this order:

1. If the member has an in-progress lesson, resume at its last saved section.
2. Otherwise, aggregate quiz results by subject and topic across the question bank and completed daily grounded reviews. Recommend the topic with the lowest accuracy when it has at least one wrong answer; link to an active, verified source document when available.
3. If there is no saved lesson progress and no weak quiz topic, start the only published Study OS lesson, “Dược liệu & Phương tễ”.
4. If that lesson is completed and there is no weak quiz topic, state that the connected curriculum has no next lesson. Do not repeat a completed lesson or invent a course sequence.

Accuracy is `100 × correct answers ÷ attempts`. Ties prefer more wrong answers, then more attempts, then the most recently practiced topic. The query excludes questions that are no longer marked `source_verified` or `expert_approved`.

## “Hôm nay nên ôn gì”

A topic is treated as due when its most recent answered quiz is at least 7 days old. The summary uses the due topic and the lowest-accuracy topic, with the latest saved quiz time available. It contains two or three sentences. When no quiz history exists, it shows an explicit “not enough data” state instead of a generated suggestion. Guests are asked to sign in.

The summary is assembled from RPC values in the client. There is no LLM call, random topic selection, fabricated accuracy, or backfill of missing history.

## Cross-hub boundary

Study OS and Y Quán are in separate repositories and Supabase projects. V1 does not combine their data. A later integration needs an approved shared topic taxonomy with stable `topic_id` values, a member identity contract across both systems, and a read-only progress exchange with clear retention and consent rules. After those contracts exist, a Y Quán topic such as “Hàn nhiệt” can map to an approved Study OS source without importing case or patient data.

## Known limits

- The current Study OS lesson catalog has one lesson and no ordered, multi-lesson curriculum.
- Lesson progress tracking starts after this release; no historic completion, elapsed study duration, or unfinished lesson is inferred.
- The active-seconds value is an estimate based on the visible lesson page and 30-second ticks, not a timer on every interaction.
- Existing quiz statistics store topic outcomes and last-seen time but not duration per quiz. The UI reports elapsed lesson time only when resuming that lesson.
