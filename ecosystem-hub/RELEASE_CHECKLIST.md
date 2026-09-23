# HIU TMC Ecosystem Hub — Production Release Checklist

## Build gate
- [x] Next.js static export succeeds.
- [x] Home route exists.
- [x] Four application detail routes exist.
- [x] Cloudflare Wrangler dry-run succeeds.
- [x] Approved anime artwork is packaged as a static WebP asset.
- [x] robots.txt, sitemap.xml, favicon and 404 are generated.
- [x] Keyboard focus states exist for hotspots and CTA links.

## Routing gate
- [x] Study OS production alias verified from deployment metadata.
- [x] A.I Thiệt Chẩn production alias verified from deployment metadata.
- [x] Trung Y Văn GitHub Pages deployment verified.
- [x] HIU YHCT Atlas GitHub Pages deployment path verified.
- [ ] Canonical subdomains under hiutmc.com are activated.

## Infrastructure gate
- [x] hiutmc.com is registered.
- [x] Cloudflare static-only wrangler configuration exists.
- [x] Production workflow is present.
- [ ] `CLOUDFLARE_API_TOKEN` is stored as a GitHub Actions secret. **Current blocker confirmed by production run #35811249110.**
- [ ] `CLOUDFLARE_ACCOUNT_ID` is stored as a GitHub Actions secret. Add together with the API token before retry.
- [ ] First production deployment succeeds. Attempt #35811249110 reached Wrangler deploy and stopped because `CLOUDFLARE_API_TOKEN` is not configured.
- [ ] SSL for hiutmc.com is active.
- [ ] Live smoke test on hiutmc.com passes.

## Release rule
Do not merge or announce production completion until every unchecked production item above has evidence.


## Current release candidate
- Development branch: `ecosystem-hub-stage-a`
- Release-candidate branch: `ecosystem-hub-rc-20260923`
- Last static CI verified source: `472356db907887d888c2da23bd8bd9c92af8717a`
- RC includes Cloudflare credential preflight through `269f1b8c11762b41a4618cc109165e07a7292235`.
- Production branch: `ecosystem-hub-production`
- First production attempt: GitHub Actions run `35811249110`
