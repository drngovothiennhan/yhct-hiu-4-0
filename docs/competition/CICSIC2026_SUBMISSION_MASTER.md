# CICSIC 2026 — Submission Master

## 1. Project identity

**International name:** YHCT Connect – An AI-Assisted Academic Social & Research Platform for Traditional Medicine Students  
**Competition product layer:** YHCT Connect × Smart Herb Kit  
**Descriptor:** A Free Phygital Learning Ecosystem for Traditional Medicine Students  
**Tagline:** Traditional Medicine Knowledge for Every Student  
**Product principle:** Near · Simple · Free

## 2. One-sentence value proposition

YHCT Connect connects physical medicinal-herb learning with a free academic digital ecosystem so students can scan, learn, verify evidence, review safety context, complete micro-learning, and continue academic discussion in one workflow.

## 3. Competition problem statement

Traditional Medicine learning is fragmented across physical specimens, lecture notes, general search engines, research databases, social networks, and generic AI tools. Students need a low-friction academic environment that connects the physical herb, structured Traditional Medicine knowledge, modern evidence, safety context, and peer learning without requiring expensive software or complex training.

## 4. Solution structure

### Platform 1 — YHCT Connect

- Public academic content for guests.
- Academic social interaction for authenticated members.
- Research retrieval and source-grounded learning support.
- Herb knowledge and safety context.
- AI Academic Copilot positioned as an educational assistant, not a doctor.

### Platform 2 — Smart Herb

- Physical herb specimen with QR-first access.
- Public `/smart-herb?herb=<slug>` route.
- Identification, part used, Traditional Medicine learning context, evidence summary, safety note, PubMed references and micro-quiz.
- Guest-readable; no app installation required.
- Current staging demo herbs: Đương quy, Sinh khương and Cam thảo.

## 5. Innovation statement

**Physical herb specimen → QR access → structured Traditional Medicine knowledge → modern evidence → safety context → micro-learning → academic community.**

The innovation is the combination of a familiar social-learning experience with traceable academic evidence and a tangible phygital entry point. The project should not be positioned as merely a chatbot, digital library, LMS or “Facebook for Traditional Medicine.”

## 6. AI boundary

AI supports retrieval, summarization, concept explanation, source discovery and educational safety reminders. It must not be presented as autonomously diagnosing disease, prescribing treatment, replacing clinicians, replacing teachers or guaranteeing therapeutic outcomes.

## 7. Current implementation status

### Implemented and validated in competition staging

- Public Smart Herb route.
- Guest deep-link access.
- Responsive mobile and desktop UI.
- Three demo herbs with traceable PubMed links.
- Explicit medical-education disclaimer.
- Micro-quiz.
- Supabase `smart_herbs` table with RLS and active-row public-read policy.
- No public mutation policy for Smart Herb.
- Static fallback data for the three demo herbs.
- Vercel preview deployment.
- Chrome rendered QA at 390×844 and 1440×1000.
- Dedicated Smart Herb Gate, Web CI and Preview workflows.

### Not yet claimed

- Measured learning-outcome improvement.
- Measured AI accuracy percentage.
- Multi-university adoption.
- Commercial revenue.
- Clinical effectiveness.
- Reduction in clinical errors.

These claims require real evidence before they can be used.

## 8. Demo flow — 45 to 60 seconds

1. Show a physical or printed medicinal-herb specimen carrying a QR code.
2. Scan using the normal phone camera.
3. Open the Smart Herb page as a guest.
4. Show the herb identity and part used.
5. Show Traditional Medicine learning context.
6. Show evidence and safety sections.
7. Open a PubMed reference.
8. Show the micro-quiz.
9. Return to YHCT Connect and explain the academic community layer.

### Demo fallback

If live network conditions are poor, use the validated staging screenshot/recording and clearly state that it is a recorded view of the same staging build. Do not simulate or fabricate live system behavior.

## 9. 60-second pitch backbone

Traditional Medicine contains centuries of knowledge, but for today’s students learning is often fragmented across physical specimens, notes, search engines, research databases, social media and generic AI tools. YHCT Connect brings these steps together in one student-friendly academic environment. With Smart Herb, a student scans a QR code on a real medicinal herb and immediately opens a structured learning profile with identification, Traditional Medicine context, modern evidence, safety notes, traceable PubMed references and a short quiz. The philosophy is Near, Simple and Free: no special hardware, no mandatory app and no account required just to learn. AI supports academic retrieval and explanation, but does not replace teachers or clinicians. Our goal is simple: make Traditional Medicine knowledge easier to access, verify, discuss and share for every student.

## 10. 15-slide competition deck structure

1. **YHCT Connect × Smart Herb** — title, tagline, one-line value proposition.
2. **The problem** — fragmented learning workflow.
3. **Why Traditional Medicine students need this** — physical + academic + evidence gap.
4. **Our solution** — YHCT Connect and Smart Herb as one ecosystem.
5. **Smart Herb demo** — scan-to-learn flow.
6. **Student journey** — Discover → Read → Verify → Quiz → Discuss → Save → Share.
7. **Academic social network** — guest-first public learning plus authenticated participation.
8. **Research + AI Academic Copilot** — source-grounded educational support.
9. **Technology architecture** — web/PWA, Supabase, research retrieval, RAG-ready architecture.
10. **Innovation** — Academic Community × Traditional Medicine × Research Retrieval × AI Assistance × Physical QR entry point.
11. **Near · Simple · Free** — product philosophy.
12. **Social and educational impact** — lower access cost and lower learning barrier.
13. **Sustainability** — free core student access, future institution-level services/partnerships.
14. **Roadmap and international scaling** — pilot, evidence, multilingual expansion, wider herb catalog.
15. **Team + vision** — contributors, advisors and “Traditional Medicine Knowledge for Every Student.”

## 11. Evidence integrity rules

- Every medical or biomedical source used in the competition package must be traceable.
- Mechanistic or preclinical findings must not be promoted as proven broad clinical efficacy.
- Product performance statistics must come from recorded tests.
- Student-outcome statistics must come from real pilot participants.
- If evidence is uncertain, state the uncertainty.
- Do not invent users, universities, revenue, contracts, accuracy rates or clinical outcomes.

## 12. Pilot evidence plan

Recommended first pilot endpoints:

- Task completion rate.
- Time from specimen scan to source retrieval.
- System Usability Scale (SUS).
- Evidence-literacy task performance.
- Ability to locate the safety note.
- Ability to identify the cited PubMed source.
- Qualitative comments on clarity and learning accessibility.

The first pilot should evaluate usability and academic workflow, not clinical outcomes.

## 13. Current release-control state

- Production branch: `main`.
- Competition branch: `competition/smart-herb-v1-stage`.
- Pull request: `#21`.
- Runtime QA commit: `581d822d2efcff7c534fe116e48b9367e34154a6`.
- Current competition branch is under documentation-only freeze after runtime validation.
- Production merge is intentionally blocked until the planned test buffer is complete.
- Any runtime change during the buffer invalidates the freeze and requires the full Smart Herb Gate, Web CI, Preview and rendered-browser QA sequence to run again.

## 14. Submission package checklist

### Mandatory / primary package

- [ ] Competition registration information completed with actual team-member data.
- [ ] Correct competition category confirmed from team leader status and business-registration status.
- [ ] 15-slide pitch deck finalized.
- [ ] Pitch deck exported to PDF for upload.
- [ ] Identity/enrollment/graduation evidence collected for each member as required.
- [ ] Non-English eligibility documents translated where required.
- [ ] Advisor information confirmed.
- [ ] Project title and short description kept consistent across portal, PDF, video and demo.

### Optional but strongly useful

- [ ] Word-format business/project plan prepared.
- [ ] 60-second product video prepared.
- [ ] Product screenshots and architecture figure prepared.
- [ ] Physical Smart Herb demonstration kit prepared.
- [ ] QR scan verified on at least one Android device and one iPhone if available.

## 15. Inputs still required from the real team

The following must not be guessed and must be provided or confirmed from real records before final submission:

- Final team leader name and competition-represented institution.
- Final team-member list and roles.
- Current enrollment/graduation status for every member.
- Final competition category.
- Business-registration status, if any.
- Advisor names and affiliations.
- Any real pilot-participant results.
- Any real adoption, partnership or revenue data.

## 16. Submission-day rule

On submission day, do not introduce risky architecture changes. Use the frozen competition build, verify the final PDF and video files, verify every portal field, confirm all proof documents, and submit with enough time to re-check the portal status before the deadline.
