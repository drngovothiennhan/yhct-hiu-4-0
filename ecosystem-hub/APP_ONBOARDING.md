# Adding a new HIU TMC ecosystem application

The Hub is designed to grow without hard-coding new application links into UI components.

## 1. Confirm the product
Before adding an application to the public Hub, confirm:
- The application has a clear educational/community purpose.
- A runnable HTTPS endpoint exists, or the status is explicitly Development.
- The product owner agrees on the public name and short name.
- No private/admin-only endpoint is exposed as a public CTA.

## 2. Reserve the canonical subdomain
Use a short, durable name under `hiutmc.com`.

Examples already reserved:
- `study.hiutmc.com`
- `thietchan.hiutmc.com`
- `trungyvan.hiutmc.com`
- `atlas.hiutmc.com`

Do not bind DNS until the upstream endpoint and TLS behavior are verified.

## 3. Add one registry entry
Edit only `data/apps.ts` for core app metadata:
- `slug`
- `name`
- `shortName`
- `tagline`
- `description`
- `status`
- `hosting`
- `currentUpstreamUrl`
- `plannedCanonicalDomain`
- `verifiedAt`
- map `x` / `y`
- `accent`

Do not hard-code the same URL into components.

## 4. Map placement
- Keep hotspot coordinates inside the 5–95% safe area.
- Do not overlap the central HIU TMC plaza.
- Do not obscure another app card at common desktop/mobile sizes.
- If the ecosystem grows beyond the current four primary districts, introduce a new map layer/region instead of stacking many hotspots into the same scene.

## 5. Status rules
- **Production**: public endpoint is verified and intended for normal users.
- **Preview**: usable test experience, but not yet the stable canonical product.
- **Development**: product is visible in the roadmap but should not be presented as production-ready.

## 6. Required validation
Run:
```
npm run validate:registry
npm run validate:assets
npm run build
npx wrangler deploy --dry-run
```

CI must pass before the change becomes a release candidate.

## 7. Release
After the Hub itself is live:
1. Verify the app upstream.
2. Add/verify the `*.hiutmc.com` canonical domain.
3. Test the link from the Hub on desktop and mobile.
4. Update `verifiedAt`.
5. Keep the old upstream documented until rollback is no longer needed.

## Guardrails
- Never put secrets in the registry.
- Never proxy member authentication through the Hub without a separately reviewed SSO design.
- Never claim medical diagnosis capability from a navigation/marketing page.
- Never add fabricated user counts, accuracy numbers, awards or activity statistics.
