# HIU YHCT 4.0 — TỨ CHẨN V1 MASTER EXECUTION PROMPT

## 0. MISSION LOCK
Build only V1 of the integrated Traditional Medicine Four Examinations app: Vọng, Văn, Vấn, Thiệt. Do not add unrelated features, do not alter stable production behavior outside the V1 boundary, and do not expand scope without an explicit later phase.

## 1. PRODUCT GOAL
Create a mobile-first PWA morning workflow:
1. Vọng: capture/scan face using browser camera, run local quality checks and face-landmark/region preparation through an adapter designed for MediaPipe.
2. Văn: record five rotating reading prompts, extract local audio features through an adapter designed for Web Audio/Meyda.
3. Vấn: present ten daily questions based on a versioned Thập vấn question bank and deterministic daily selection.
4. Thiệt: integrate the existing tongue-diagnosis capability only through a stable adapter contract; do not rewrite the existing tongue engine in V1.
5. Fusion: normalize structured outputs from all four modules and generate a non-diagnostic wellness/YHCT support summary through a provider-agnostic AI adapter designed for Gemini.
6. Trend storage: persist dated structured sessions behind a storage adapter designed for Firebase/Firestore, with local fallback for development.

## 2. NON-NEGOTIABLE ARCHITECTURE
- TypeScript-first.
- Strong domain schemas for all four examination outputs.
- No direct Firebase/Gemini/MediaPipe/Meyda calls from UI components; use adapters/services only.
- Every adapter must have a local/mock fallback so V1 can run without cloud keys.
- Session schema must be versioned from day one.
- Deterministic daily rotation must be based on date + stable user seed.
- No raw camera stream upload by default.
- No raw audio upload by default.
- Keep health wording as screening/wellness support; never claim a definitive diagnosis.
- Add red-flag routing only as a generic safety boundary, not a disease diagnosis engine.

## 3. V1 MODULE CONTRACTS
### Observation / Vọng
Return structured data only: quality score, face-present flag, pose/lighting checks, prepared region metrics placeholder, confidence, adapter version.

### Listening / Văn
Return structured data only: five prompt IDs, duration, RMS/loudness-like measure, zero-crossing/spectral placeholders, pause ratio placeholder, confidence, adapter version.

### Inquiry / Vấn
Return exactly ten daily questions selected from a versioned question bank covering Thập vấn domains. Persist answer IDs and normalized tags, not freeform interpretations only.

### Tongue / Thiệt
Use a `TongueDiagnosisAdapter` contract. V1 must accept the current tongue engine output when connected, and otherwise run a clearly marked mock/local adapter. Required normalized fields: tongue color, coating color, coating thickness, moisture, fissure, teeth marks, quality score, confidence, adapter version.

### Fusion
Input only normalized structured JSON from the four modules plus minimal session metadata. Output a structured report: summary, signals, trend note, YHCT interpretation phrased as supportive/non-diagnostic, confidence, recommendations, red flags.

## 4. DATA MODEL
Use a single versioned `FourExamSessionV1` model containing:
- id, userId, localDate, startedAt, completedAt, schemaVersion
- observation
- listening
- inquiry
- tongue
- fusionReport
- providerVersions

Keep migration-ready boundaries so V2 can add pulse diagnosis, richer ML models, or longitudinal scoring without rewriting V1 UI.

## 5. UI SCOPE
One primary entry point: `Bắt đầu Tứ Chẩn sáng nay`.
Flow: Vọng 1/4 → Văn 2/4 → Vấn 3/4 → Thiệt 4/4 → Tổng hợp.
Include only:
- permissions/quality guidance
- step progress
- retry for invalid capture
- session completion report
- basic history list for prior sessions if storage already exists
Do not add social, chat, marketplace, news, gamification, clinician dashboard, admin CMS, payments, or unrelated settings in V1.

## 6. GOOGLE-FIRST INFRASTRUCTURE
Prepare adapters/env contracts for:
- Firebase Auth
- Firestore
- Firebase Storage only when raw media retention is explicitly enabled later
- Firebase App Check
- Gemini API through server-side gateway/Cloud Run-compatible endpoint
V1 must not require paid cloud services to boot locally.

## 7. IMPLEMENTATION QUALITY GATES
Before merge:
- Typecheck passes.
- Existing tests remain green.
- New unit tests cover deterministic daily question/prompt rotation, schema validation, fusion fallback, and storage fallback.
- Mobile viewport flow works end-to-end with mock adapters.
- No secrets committed.
- No direct provider coupling inside presentation components.
- Existing production modules outside V1 remain untouched unless import wiring is strictly required.

## 8. ACCEPTANCE CRITERIA
V1 is complete only when a user can run the full 4-step morning workflow in browser/PWA mode without cloud credentials, receive a structured non-diagnostic summary, and the same codebase can later switch to MediaPipe/Meyda/Firebase/Gemini/current tongue engine through adapters rather than UI rewrites.

## 9. EXECUTION RULE
Implement exactly this V1 and stop. Record remaining integrations as future adapters/TODOs; do not implement V2 features in this phase.
