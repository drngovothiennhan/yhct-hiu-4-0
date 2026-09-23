# hiutmc.com DNS / Routing Plan

## Root
- `hiutmc.com` → HIU TMC Ecosystem Hub on Cloudflare Workers Static Assets.
- Hub remains static-only; no origin server is required.

## Application subdomains
- `study.hiutmc.com` → Study OS current verified upstream until its independent migration is completed.
- `thietchan.hiutmc.com` → A.I Thiệt Chẩn current verified upstream until its independent migration is completed.
- `trungyvan.hiutmc.com` → `https://drngovothiennhan.github.io/trung-y-van-hiu/`.
- `atlas.hiutmc.com` → `https://drngovothiennhan.github.io/human-atlas/`.

## Rules
1. Never replace a working upstream with a canonical subdomain before HTTPS and redirect behavior are verified.
2. Keep app routing metadata in `data/apps.ts`; do not hard-code endpoints in components.
3. Prefer static hosting for public educational content.
4. Do not proxy authentication/session APIs through the Hub.
5. Member applications retain their own deployment lifecycle.
6. DNS changes must be reversible and documented with the previous target.
