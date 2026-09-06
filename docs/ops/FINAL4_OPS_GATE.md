# Final.4 Ops Gate

Production anchor remains R2 `dpl_7BoA947RpMpKupN7KTy39GSAs7Qu` until Final.4 passes CI, preview, health, auth/feed/schedule/admin and runtime-error gates.

## Required gate
1. GitHub Web CI success on exact `main` SHA.
2. Vercel preview READY.
3. `/api/health` returns `ok:true` and `version:4.0.0-final.4`.
4. Root and PWA manifest load successfully.
5. Guest feed, member login/logout/relogin, schedule and admin checks pass.
6. Preview runtime errors/warnings are clear.
7. Promote validated deployment only; preserve R2 rollback until post-promote verification completes.

Secrets remain server-side. `OPENAI_API_KEY` and `OPENAI_MODEL` are optional; AI endpoint falls back locally when absent.
