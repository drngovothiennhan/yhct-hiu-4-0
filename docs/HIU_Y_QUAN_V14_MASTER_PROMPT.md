# HIU Y QUAN V14 — MASTER EXECUTION PROMPT

## Role
Act as Principal Frontend Engineer, Supabase Game Engineer, QA Lead and YHCT educational-content curator for YHCT HIU 4.0.

## Mission
Upgrade HIU-Y-Quán without breaking V11–V13 behavior. Deliver production code, migrations, responsive UI and automated contracts; do not use pseudocode, placeholders or fabricated clinical claims.

## Non-negotiable invariants
- Preserve the three scenes: Chẩn Mạch, Dưỡng Trị, Chế Dược.
- Preserve server-authoritative diagnosis, one-time Gia Viên credit, appointment RPCs, doctor gender/outfit persistence and current responsive behavior.
- Keep Vercel Hobby serverless routes at or below 12.
- Treat every patient, diagnosis, treatment and recheck as a fictional educational simulation, never a real clinical recommendation.
- The 10-minute observation and any retry timer are game mechanics, not clinical protocols.

## V14 deliverables
1. Make the in-scene medicine cabinet and Dược phòng drawers touch/click interactive. A drawer opens a compact card with herb name, Latin pharmacopoeial name, Tính vị, Quy kinh, Công năng and Chủ trị. Curate content from trustworthy current pharmacopoeial/official TCM references, but do not expose source annotations in the in-game card. Do not show dosing or prescribing instructions.
2. After the player submits a syndrome diagnosis, place the case into `awaiting_transfer`. Require an explicit player action to move the patient to Dưỡng Trị. Persist `treatment_started_at` and `recheck_due_at` server-side for a 10-minute game observation interval.
3. Keep observing patients visibly in the Dưỡng Trị room even after navigation/reload. When due, enable server-authoritative recheck. A pedagogically stable case is discharged; a learning-mismatch case receives one bounded extra observation cycle. Never describe this state machine as medical treatment guidance.
4. On discharge, set `archived_at`, remove the case immediately from the active queue, and expose it through a searchable `Sổ bệnh án` RPC/UI containing demographics, Tứ chẩn, expected/selected syndrome, correctness and timeline.
5. Generate deterministic patient ages across child (5–12), teen (13–17), adult (18–59) and senior (60–90) bands, both genders, with 3 stable visual variants. Render age-appropriate chibi proportions/accessories in consultation, ward and record views.
6. Preserve fallback compatibility with `hiu_y_quan_hourly_cases_v2/v1`; V3 is preferred. All new game-changing actions must be authenticated RPCs with explicit return contracts.
7. Add V14 CSS after V13, avoid viewport-height stretching, support mobile/desktop/desktop-on-phone and reduced-motion mode.
8. Add a V14 contract test to prebuild covering lifecycle constraints, exact timers, archive filtering, herb-card shape, auth restrictions, age bands, frontend RPC wiring, responsive guards and the 12-function Vercel budget.

## Acceptance gate
Do not release until TypeScript/Vite build passes, all V11–V14 contracts pass, npm audit gate passes, Chrome responsive smoke passes, production Supabase function signatures/privileges are verified, Vercel reaches READY, `/api/health` returns 200, and production runtime shows no new 5xx errors.
