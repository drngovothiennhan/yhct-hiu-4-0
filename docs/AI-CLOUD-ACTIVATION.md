# YHCT HIU 4.0 — Cloud AI activation

Production cloud AI is enabled only when all server-side conditions are true:

- `ENABLE_CLOUD_AI=true`
- `OPENAI_API_KEY` is present as a Vercel Production Secret
- the configured/default OpenAI model is accepted by the runtime

The browser must never receive or persist `OPENAI_API_KEY`.

After any Production environment-variable change, create a fresh production deployment so the new function runtime receives the updated environment.

Operational verification endpoint:

`GET /api/ai/health`

Expected healthy cloud state:

```json
{
  "ok": true,
  "ai": {
    "mode": "cloud+local",
    "cloudReady": true,
    "localFallback": true,
    "structuredOutputs": true,
    "citationWhitelist": true
  }
}
```

If cloud readiness is false, keep local fallback enabled and do not expose secrets in logs, client bundles, screenshots, or support messages.
