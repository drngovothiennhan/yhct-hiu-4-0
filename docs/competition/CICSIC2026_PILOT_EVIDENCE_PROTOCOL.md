# CICSIC 2026 — Pilot & Evidence Protocol

## Purpose

This protocol defines how YHCT Connect + Smart Herb will collect defensible competition evidence without fabricating traction, learning outcomes or clinical claims.

The pilot evaluates **usability, evidence-oriented learning workflow and accessibility**. It does not evaluate diagnosis, prescribing or clinical treatment outcomes.

## Primary research question

**Can a student-centered phygital academic platform reduce friction when Traditional Medicine students move from a physical medicinal-herb specimen to structured learning and traceable research evidence?**

## Minimum viable pilot

### Participants
- Target: currently enrolled students studying Traditional Medicine, pharmacy, medicinal plants or closely related health-science subjects.
- Initial pilot may be single-site.
- Participant count must be reported exactly as recruited; no target count may be presented as completed participation.

### Test objects
- Three competition demo herbs: Đương quy, Sinh khương and Cam thảo.
- Each specimen or printed specimen card receives a QR code linking to the corresponding Smart Herb route.

### Comparator workflow
**Conventional workflow:** participant receives the herb name/specimen and is asked to find identification information, a safety note and one research source using their usual tools.

**Smart Herb workflow:** participant scans the QR code and completes the same information-retrieval tasks through Smart Herb.

## Primary endpoints

1. **Task completion rate** — whether the participant can reach all requested information items.
2. **Time to traceable source** — time from task start to opening a PubMed-linked source.
3. **Source-traceability success** — whether the participant can identify the PMID or publication source used.
4. **Safety-information retrieval** — whether the participant can locate the product safety note and correctly state that the tool is educational rather than diagnostic/prescriptive.

## Secondary endpoints

- System Usability Scale (SUS).
- Perceived ease of use on a 5-point Likert scale.
- Perceived accessibility on a 5-point Likert scale.
- Confidence in finding evidence on a 5-point Likert scale.
- Short qualitative feedback: what was easiest, what was confusing, what should change.
- Micro-quiz completion and correctness.

## Data integrity rules

- Preserve raw timestamps and raw survey responses.
- Do not delete inconvenient responses.
- Predefine exclusion rules before analysis.
- Report missing data.
- Distinguish planned sample size from completed sample size.
- Never convert club membership records into active-user counts.
- Do not claim statistical significance unless the statistical test is appropriate and reported.
- Do not claim clinical benefit from usability or learning-workflow data.

## Minimum dataset fields

| Field | Description |
| --- | --- |
| participant_id | Anonymous pilot identifier |
| study_program | Broad academic program; avoid unnecessary personal details |
| academic_year | Study year if voluntarily collected |
| workflow | conventional / smart_herb |
| herb_slug | tested herb |
| task_completed | yes/no |
| seconds_to_source | measured task duration |
| source_traceable | yes/no |
| safety_note_found | yes/no |
| educational_boundary_understood | yes/no |
| quiz_correct | yes/no |
| sus_score | calculated SUS score when completed |
| ease_score | 1–5 |
| accessibility_score | 1–5 |
| evidence_confidence_score | 1–5 |
| qualitative_feedback | optional free text |

## Analysis plan

For the first competition pilot, use descriptive statistics first: count, proportion, median, interquartile range and clearly labeled participant numbers.

If the same participants complete both workflows, paired comparisons may be considered for time-to-source and task success. Any inferential test must be selected after confirming the data structure and sample size.

Do not pre-write p-values, effect sizes or percentage improvements.

## Success criteria for competition readiness

A pilot can support the competition narrative when:
- the procedure is documented and repeatable;
- participant records are real and auditable;
- raw data are retained;
- reported numbers can be regenerated from the raw dataset;
- product limitations are reported together with strengths;
- no clinical-performance inference is made.

## Evidence pack structure

The evidence folder should contain:
1. pilot protocol version used;
2. participant information/consent material if required by the institution;
3. anonymized raw dataset;
4. analysis output;
5. screenshots of the tested build;
6. exact Vercel deployment identifier and Git commit;
7. Supabase security check relevant to Smart Herb;
8. PubMed citation verification for each competition demo herb;
9. known limitations and deviations from protocol.

## Current verified technical evidence before participant pilot

The current staging candidate already has the following non-user evidence:
- Smart Herb static release verifier passed 22/22 checks;
- TypeScript compilation passed;
- production Vite bundle passed;
- rendered guest Chrome QA passed at 390×844 and 1440×1000;
- selected-herb deep-link, disclaimer and academic-source section were verified in rendered DOM;
- Smart Herb Supabase table uses RLS with active-row public read and no public mutation policy;
- the three competition PMIDs have been resolved through PubMed;
- Vercel staging deployment reached READY and the Smart Herb route was successfully built.

These checks demonstrate technical readiness only. They are not substitutes for student-pilot evidence.

## Test-buffer rule

During the test buffer:
- keep PR #21 in Draft;
- keep production `main` unchanged;
- allow documentation and pilot preparation changes;
- allow runtime code changes only for confirmed blockers;
- if runtime code changes, repeat the full Smart Herb Gate, Web CI, Vercel Preview and rendered mobile/desktop QA before treating the build as competition-ready again.