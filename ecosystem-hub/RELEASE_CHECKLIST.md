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
- [ ] CLOUDFLARE_API_TOKEN is stored as a GitHub Actions secret.
- [ ] CLOUDFLARE_ACCOUNT_ID is stored as a GitHub Actions secret.
- [ ] First production deployment succeeds.
- [ ] SSL for hiutmc.com is active.
- [ ] Live smoke test on hiutmc.com passes.

## Release rule
Do not merge or announce production completion until every unchecked production item above has evidence.
