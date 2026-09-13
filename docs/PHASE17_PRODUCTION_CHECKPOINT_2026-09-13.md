# Phase 17 production hotfix checkpoint — 2026-09-13

## Verified release
- Repository: drngovothiennhan/yhct-hiu-4-0.
- PR #104 was merged to 385530a43bc671fd3ff25af9b50c4812cbaabd85; Web CI #705 passed; deployment dpl_GsHXjVAeetMM8vaeFQ6LmNyEvKii failed with exceeded_serverless_functions_per_deployment.
- Hotfix PR #105 MERGED: https://github.com/drngovothiennhan/yhct-hiu-4-0/pull/105
- Hotfix code head: 3a21794898ab26cab4e04fb021d8129c22c3d28b.
- Production/main SHA: 8cf1b2b0efd1847e5f7097802468b2336800c537.
- Exact release tree: 2f68962b694aa7a767db6c2f07f9d7ccd71699c9.
- PR Web CI #707 PASS: https://github.com/drngovothiennhan/yhct-hiu-4-0/actions/runs/34740696012
- Main Web CI #708 PASS: https://github.com/drngovothiennhan/yhct-hiu-4-0/actions/runs/34740771528
- Vercel Production #594 PASS: https://github.com/drngovothiennhan/yhct-hiu-4-0/actions/runs/34740839641
- Deployment: dpl_7pu6Ts8QHo2yLHZwUG1zDw4jvmWM, READY.
- githubCommitSha matches exact main SHA above.
- Alias confirmed on deployment: https://yhct-hiu-final4-stage.vercel.app
- Production workflow Chrome smoke and rendered-content tests PASS (390x844 mobile and 1440x1000 desktop).
- Live GET /api/ai/assistant returned expected 405 JSON Method not allowed; no 404 or import/runtime 500.
- Vercel deployment completed successfully; function-limit blocker resolved.

## Changes
- POST /api/ai/assistant dispatches mode=study to api/_lib/study-assistant-handler.js.
- Standalone api/ai/study-assistant.js removed.
- studyAiService sends mode, query, conversationContext, pageContext separately.
- Gemini grounded search, Gemini text fallback, authorization, Research routing and privacy retained.
- Answer paragraph breaks preserved.
- Research handoff button preserves the original query.
- Explicit “Mở lịch học” maps to /schedule.
- New audit:phase17 runs in prebuild/Web CI; tests context, auth, Research intents, fallback, internal-source exclusion, calendar navigation and 12-function budget.
- No provider/infrastructure, database, RBAC, grading, Garden or game changes.

## Function budget
12 deployable api entrypoints:
api/ai/assistant.js
api/ai/diagnostics.js
api/ai/docx-summary.js
api/ai/drive-rag.js
api/ai/exam-gap.js
api/ai/health.js
api/ai/research-proposal.js
api/health.js
api/knowledge/resources.js
api/manifest.js
api/translate.js
api/weather.js

## Outstanding authenticated production acceptance — NOT CLAIMED PASS
The cloud browser is signed out. Source/runtime tests use mocked provider responses and do not prove live Gemini answer quality.
Complete with an approved member session:
1. Tạng tượng là gì?
2. So sánh Tỳ khí hư và Tỳ dương hư
3. Follow-up: Vậy điểm khác nhau quan trọng nhất là gì?
4. Tìm PubMed về châm cứu mất ngủ; verify Research destination and preserved query.
5. Floating assistant: Mở lịch học.
6. Floating assistant: Giải thích âm dương ngũ hành; verify Gemini Study handoff.
Check AI Center composer, floating-assistant hiding, actual context answers and provider errors.
Use secure browserAuth for credentials. Do not read/reuse token files, manufacture sessions or weaken privacy/authentication.
Do not mark the entire user acceptance DONE until these checks pass.

## Continue safely
Read current remote main, deployment and this checkpoint before any edits. Do not reset newer work.
The hotfix is already merged and deployed; do not reimplement it or redeploy without a concrete need.
No new Study OS features were started.
Local source snapshot: /workspace/scratch/b415ddc86a32/repo. Its release tree exactly matched the remote release tree above. Local git history is a reconstructed snapshot, not fetched GitHub history: do not push that local history. Use a proper remote checkout or GitHub connector mutations with expected parents.
This checkpoint is documentation on phase17-hotfix-vercel-function-limit after release; it does not change production code.
Credit/quota balance is not exposed to this agent; do not claim to measure remaining Astra credit. Resume the bounded authenticated acceptance before expanding scope.
