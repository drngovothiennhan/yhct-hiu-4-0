# Cloudflare release setup — hiutmc.com

This file is intentionally credential-free. Never commit API tokens, account IDs, passwords or recovery codes.

## Architecture
- Product: `hiutmc-ecosystem`
- Production domain: `https://hiutmc.com`
- Hosting: Cloudflare Workers Static Assets
- Runtime Worker code: none
- Static build directory: `ecosystem-hub/out`

## Required GitHub Actions secrets
Repository → Settings → Secrets and variables → Actions:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Do not store either value in source files or workflow YAML.

## Least-privilege token plan

### First production deployment
Because `hiutmc-ecosystem` does not exist yet, the token must be allowed to create the Worker:
- Workers product: **Admin** (needed to create a new Worker).
- Zone `hiutmc.com`: **Workers Routes Write** (needed to attach/change the custom domain).

Scope the zone permission to `hiutmc.com`, not all zones, when the Cloudflare UI allows it.

### After the first successful deployment
Reduce privileges:
- Worker `hiutmc-ecosystem`: **Editor**, or Workers product **Editor** if per-Worker token scope is not practical.
- Keep Zone `hiutmc.com` → **Workers Routes Write** only while the CI deployment is allowed to modify the custom-domain connection.

If the custom-domain connection is no longer managed by Wrangler during routine deploys, remove unnecessary zone-write permission.

## Release command
The GitHub workflow executes Wrangler with the repository configuration:

```
wrangler deploy
```

The same workflow then smoke-tests:
- `/`
- `/ecosystem/study-os/`
- `/ecosystem/ai-thiet-chan/`
- `/ecosystem/trung-y-van/`
- `/ecosystem/atlas/`
- required security headers

## Safety
1. Never paste `CLOUDFLARE_API_TOKEN` into ChatGPT or a commit.
2. Never use the Cloudflare Global API Key for this pipeline.
3. Use a dedicated CI token that can be revoked independently.
4. Rotate/revoke the bootstrap token after the first deployment if it has broader Admin permission than routine deployments require.
5. Production is not considered complete until `npm run smoke:production` passes against `https://hiutmc.com`.
