# CICSIC 2026 — Smart Herb Release Dossier

## Competition product identity

**YHCT Connect / YHCT HIU 4.0 — Smart Herb**  
**Tagline:** Traditional Medicine Knowledge for Every Student  
**Product principle:** Near · Simple · Free

Smart Herb is the physical-to-digital learning layer of YHCT Connect. A student can scan a QR code placed on a real medicinal-herb specimen and open a public academic profile containing identification notes, the plant part used, Traditional Medicine learning context, modern evidence, safety notes, traceable references, and a short micro-quiz. Reading does not require an account.

## Problem → product fit

Traditional Medicine students commonly encounter fragmented learning: physical herb specimens are learned in one setting, notes in another, research evidence in separate databases, and discussion in generic social networks. Smart Herb creates one low-friction path from a real specimen to a structured, source-traceable learning page.

The competition claim is deliberately narrow and testable: **Smart Herb reduces the steps needed to move from a physical herb specimen to structured academic learning and evidence retrieval.** It does not claim to diagnose, prescribe, or replace teachers or clinicians.

## Competition demo flow

1. Show a real or printed herb specimen carrying a QR code.
2. Scan the QR code with a normal phone camera; no separate app installation is required.
3. Open `/smart-herb?herb=<slug>` as a guest.
4. Review identification, part used, Traditional Medicine learning context, modern evidence and safety notes.
5. Open the traceable PubMed source.
6. Complete the micro-quiz.
7. Return to YHCT Connect to continue academic discussion or research discovery.

**Target demo time:** 45–60 seconds.

## Implemented in staging

- Public `/smart-herb?herb=<slug>` route.
- Guest-readable experience without sign-in.
- Mobile and desktop responsive UI.
- Searchable herb catalog.
- Three verified competition demo herbs: Đương quy, Sinh khương, Cam thảo.
- Traceable PubMed links.
- Explicit medical-education disclaimer and safety-first language.
- Micro-quiz.
- Supabase `smart_herbs` table with RLS and active-row public read policy.
- No public mutation policy for the Smart Herb catalog.
- Offline-safe fallback data for the three demo herbs.
- Vercel deep-link support while preserving existing manifest routing and keeping Git auto-deploy disabled.

## Evidence status

The following PubMed records were independently resolved during the release review:

| Demo herb | PMID | Verified publication |
| --- | --- | --- |
| Đương quy (*Angelica sinensis*) | 41976194 | 2026 review on Dang Gui and active chemical components |
| Sinh khương / Ginger (*Zingiber officinale*) | 39199328 | 2024 review on ginger and hallmarks of aging |
| Cam thảo / Glycyrrhizic acid | 42543293 | 2026 review on anti-tumor pharmacological activities and mechanisms of glycyrrhizic acid |

The interface uses cautious evidence wording. Mechanistic or preclinical findings are not presented as proof of broad clinical efficacy.

## Medical safety boundary

Smart Herb is an educational product. It must not generate or imply individualized diagnosis, prescriptions, treatment plans or guaranteed therapeutic outcomes. Every herb profile contains a safety note and the product-level statement that educational content does not replace professional diagnosis or treatment.

## Release verification

Current staging release gates include:

- Static Smart Herb verifier: 22/22 checks passed.
- TypeScript compile: passed.
- Vite production build: passed.
- Rendered guest Chrome QA at 390×844: passed.
- Rendered guest Chrome QA at 1440×1000: passed.
- Rendered DOM checks include the selected herb, hero statement, safety disclaimer and academic-source section.
- Mobile and desktop screenshots are retained as CI artifacts.
- Vercel preview `/smart-herb?herb=cam-thao`: HTTP 200.
- Smart Herb-specific Supabase RLS review: passed for intended public-read / no-public-write behavior.

## Current staging identifiers

- Repository: `drngovothiennhan/yhct-hiu-4-0`
- Branch: `competition/smart-herb-v1-stage`
- Pull request: `#21`
- Production branch: `main`
- Production merge status: **not merged**

Production remains unchanged while the test buffer is in progress.

## Claims that are not yet permitted

Do not claim any of the following until supported by measured evidence:

- a specific number of active users;
- a percentage improvement in learning outcomes;
- a percentage AI accuracy rate;
- adoption by multiple universities;
- reduced clinical error rates;
- validated diagnostic or therapeutic performance;
- commercial revenue or institutional contracts.

## Pilot evaluation plan

The first pilot should evaluate product usability and academic learning workflow rather than clinical outcomes. Suitable endpoints include task-completion rate, time from specimen scan to source retrieval, System Usability Scale (SUS), perceived learning accessibility, evidence-literacy tasks, and qualitative student feedback.

A simple within-session benchmark can compare the Smart Herb workflow with a conventional multi-step search workflow. Any competition statistic must be reported only after actual participant data are collected and documented.

## Competition positioning

Smart Herb should be presented as the tangible, demonstrable product layer that makes the broader YHCT Connect vision concrete:

**Physical herb specimen → QR access → structured Traditional Medicine knowledge → modern evidence → safety context → micro-learning → academic community.**

This is stronger than positioning the project as “a social network with AI” because the jury can immediately see a real-world student use case, a physical-digital bridge, a safety boundary, and a verifiable evidence trail.

## Next release gate

The only remaining merge gate for this staging candidate is completion of the planned test buffer. The PR must remain Draft and production must remain unchanged until that gate is explicitly closed.
