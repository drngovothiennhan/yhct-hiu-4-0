# Phase 18D — Grounded Gemini quiz

Base main: f31b2ff7747a5fdbdcbeeda89f447f0eb086abc8 (Phase 18C, PR #115). Base Web CI and Vercel Production succeeded.

Implemented: separate Google Search citation-bearing notes from schema-constrained quiz generation; prompts target Scholar, Studocu, Scribd, Tailieu and open academic sources, skipping inaccessible content; require exact requested question count, four distinct nonempty options, integer answer and valid source indexes; distinguish source/validation/quota/timeout/provider errors. Reuses shared assistant endpoint. 50s combined generation budget, 60s function/client deadlines.

Validation: phase18d mocked runtime regression PASS; Phase18A and AI/AI-role audits PASS; full npm build PASS on final code. CI includes runtime regression.

Limit: no authenticated member session in cloud browser; live Gemini generation and semantic/source accuracy remain unverified. Google Search chooses actual queries; prompt targeting does not guarantee every listed platform is accessed. No paywall bypass and no fabricated citations.

Next gate: PR CI, merge exact tested head, main Web CI, Vercel Production, authenticated Bát cương 10-question smoke. Do not mark live quiz acceptance complete until actual generation succeeds.

## Release verification

- PR #116 merged after Web CI #746 PASS (run 34758643261).
- Production source SHA: 969fea1e9dde3de1d600fdb83f39b7e08ab05dcc.
- Main Web CI run 34758738516: PASS.
- Vercel Production run 34758814363: PASS.
- Deployment dpl_9ZKgETQfjqES7Ga1dbARGWHDfQhw READY; production alias bound, source SHA matched by workflow.
- Production Chrome mobile and desktop smoke: PASS.
- Stopping gate: authenticated live quiz generation (Bát cương, 10 questions), plus actual source and answer review. Not yet passed; guest browser cannot invoke member-only quiz generation.
