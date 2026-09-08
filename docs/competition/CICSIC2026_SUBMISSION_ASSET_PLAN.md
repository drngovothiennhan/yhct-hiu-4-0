# CICSIC 2026 — Submission Asset Plan

## Purpose

This file locks the remaining non-runtime assets for the competition package while the Smart Herb runtime stays frozen under PR #21.

## 1. 60-second video storyboard

### 0–6 s — Problem
**Visual:** physical medicinal-herb specimen beside scattered notes/search tabs.  
**Voice:** “Traditional Medicine students often move between physical specimens, notes, search engines, research databases and generic AI tools just to understand one herb.”

### 6–12 s — Product reveal
**Visual:** YHCT Connect × Smart Herb title, QR label on herb sample.  
**Voice:** “YHCT Connect brings that fragmented journey into one free, student-friendly academic ecosystem.”

### 12–22 s — Scan
**Visual:** phone camera scans QR on a real herb specimen.  
**Voice:** “With Smart Herb, students scan a normal QR code—no special hardware and no separate app required.”

### 22–36 s — Structured learning page
**Visual:** herb identity, part used, Traditional Medicine context, evidence and safety sections.  
**Voice:** “The page connects identification, Traditional Medicine learning context, modern evidence, safety notes and traceable references.”

### 36–43 s — Evidence
**Visual:** open the cited PubMed record.  
**Voice:** “Sources are visible and traceable, so students can verify rather than simply trust an answer.”

### 43–49 s — Micro-learning
**Visual:** micro-quiz interaction.  
**Voice:** “A short quiz turns passive reading into active learning.”

### 49–56 s — Academic community
**Visual:** return to YHCT Connect academic feed/research interface.  
**Voice:** “Students can then continue into academic discussion, research discovery and source-grounded AI assistance.”

### 56–60 s — Vision
**Visual:** project title + tagline.  
**Voice:** “Near. Simple. Free. YHCT Connect—Traditional Medicine Knowledge for Every Student.”

## 2. Recording rules

- Target 55–60 seconds; never exceed the portal limit.
- Prefer a real phone scan of the real QR label.
- Use the validated staging build or a clearly identified recording of it.
- Do not add fake counters, fake user numbers or fake institutional logos.
- Keep disclaimer visible in at least one product shot.
- If using a recorded fallback for network reliability, state internally that it is a recording of the validated staging build; do not imply an unavailable live connection.
- Keep all medical wording educational, not diagnostic or therapeutic.

## 3. Required deck visuals

1. Hero image: real medicinal-herb sample + phone showing Smart Herb.
2. Problem map: fragmented journey before YHCT Connect.
3. Product ecosystem diagram: Smart Herb ↔ YHCT Connect.
4. Scan-to-learn flow: specimen → QR → structured page → PubMed → quiz → discussion.
5. Guest-first access screenshot.
6. Evidence/safety screenshot.
7. Architecture diagram.
8. Near · Simple · Free visual.
9. Pilot-measurement plan visual.
10. Roadmap visual.

## 4. Architecture figure content

Use a simple four-layer diagram:

**Experience layer**  
Guest Web/PWA · Member Academic Social · Smart Herb QR Entry

↓

**Academic intelligence layer**  
Search · Research retrieval · RAG-ready Academic Copilot · Safety reminders

↓

**Data layer**  
Supabase academic/social data · `smart_herbs` catalog · source metadata

↓

**Evidence layer**  
PubMed and other traceable academic sources

The diagram must not imply that PubMed endorses the project or that the AI independently validates clinical efficacy.

## 5. Physical Smart Herb kit — competition MVP

### Minimum viable physical set
- 3 transparent herb containers or clean specimen packets.
- 3 printed labels: Đương quy, Sinh khương, Cam thảo.
- QR label at least 35 mm wide for reliable camera testing.
- One phone for primary live demo.
- One backup phone if available.
- Printed one-page fallback screenshot sheet.

### Final label copy
**YHCT Connect — Smart Herb**  
**Scan to learn · No app required**  
**Educational use only — not for diagnosis or treatment**

Do not print final permanent QR labels until a stable public competition URL is locked. Temporary staging share-token QR codes are QA-only because the access token expires.

## 6. Real-phone acceptance checklist

### Android
- [ ] QR detected by default camera.
- [ ] Link opens in browser.
- [ ] No login required.
- [ ] Correct herb slug selected.
- [ ] No horizontal overflow.
- [ ] Evidence section readable.
- [ ] Safety disclaimer visible.
- [ ] PubMed link opens.
- [ ] Micro-quiz works.
- [ ] Browser Back returns cleanly.

### iPhone / iOS if available
- [ ] QR detected by Camera.
- [ ] Safari opens deep link.
- [ ] No login required.
- [ ] Correct herb slug selected.
- [ ] No horizontal overflow.
- [ ] PubMed link opens.
- [ ] Micro-quiz works.

### Network conditions
- [ ] Wi-Fi test.
- [ ] Mobile-data test.
- [ ] Slow-network test if practical.
- [ ] Fallback data behavior verified if Supabase request fails.

## 7. Screenshot capture standard

Capture only from a validated build.

Required screenshots:
- Mobile hero and selected herb.
- Mobile evidence + safety section.
- Desktop full layout.
- PubMed source opening.
- Micro-quiz.
- YHCT Connect academic community view.

Recommended filename convention:
- `01-smart-herb-mobile-hero.png`
- `02-smart-herb-mobile-evidence-safety.png`
- `03-smart-herb-desktop.png`
- `04-pubmed-traceability.png`
- `05-smart-herb-quiz.png`
- `06-yhct-connect-community.png`

## 8. Final QR release condition

Permanent QR codes may be generated only when all conditions are true:

- Stable public URL selected.
- URL does not require an expiring share token.
- HTTPS confirmed.
- `/smart-herb?herb=<slug>` deep-link confirmed by HTTP and rendered browser QA.
- Guest access confirmed.
- Final URL is approved for competition printing.

After the stable URL is locked, regenerate QR codes from the canonical URL and re-run physical scan tests before printing the final kit.

## 9. Asset integrity rule

Every screenshot, diagram and product claim in the competition package must map to one of these states:

- **Implemented and validated**
- **Prototype / staging**
- **In development**
- **Proposed roadmap**

Do not visually present roadmap features as already implemented.

## 10. Freeze status

Runtime remains frozen at validated Smart Herb behavior. This asset plan is documentation-only. Any later runtime change must reopen the full technical QA sequence before merge eligibility can be reconsidered.
