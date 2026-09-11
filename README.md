# YHCT HIU 4.0

Main production repository for **YHCT HIU 4.0 — Mạng xã hội Học thuật & Luyện thi Y học Cổ truyền**, Trường Đại học Quốc tế Hồng Bàng - Khoa Y.

## AI source of truth
Before changing any A.I behavior, routing, provider integration or A.I UX, read `docs/AI_CANONICAL_ARCHITECTURE_2026-09-11.md`. It overrides older AI prompts/docs when they conflict.

Current product roles:
- **A.I Mini / XiaoZhi** = Trợ lý ứng dụng, public/default interaction layer.
- **Trung tâm nghiên cứu** = Research A.I for academic/medical literature workflows.
- **Module-specific AI** = contextual capabilities such as Exam Tutor / ACC Quiz Designer, not standalone provider chatbots.

## Architecture
- Web P0: React 18 + TypeScript + Vite + PWA
- Shared backend: Supabase Auth/Postgres/RLS/versioned RPC/API
- Android readiness: Capacitor, App ID `edu.hiu.yhct40`
- AI provider secrets remain server-side; Web/Android never receive provider secrets
- Deployment: Vercel preview gates first, then production promotion

## Security
Never commit OpenAI/Gemini keys, Supabase service-role keys, passwords, private keys, or member/private medical data. Browser configuration is limited to publishable Supabase values. Server secrets belong only in deployment environment variables.

## Development
```bash
npm install
npm run dev
npm run build
```

## Release rule
`main` is the production source-of-truth. Web stability is required before Android/Google Play promotion. Production alias must not be changed until build, health, authentication, feed, schedule, admin and runtime-error gates pass.
