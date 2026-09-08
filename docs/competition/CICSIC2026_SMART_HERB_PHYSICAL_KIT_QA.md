# CICSIC 2026 - Smart Herb Physical Kit QA

## Purpose

This document freezes the physical-demo procedure for the Smart Herb competition prototype while production remains unchanged.

## MVP physical kit

The current competition kit uses three demo specimens only:

| Specimen | Slug | Demo purpose |
| --- | --- | --- |
| Đương quy | `duong-quy` | Show a classical Traditional Medicine herb linked to a structured academic profile and PubMed evidence |
| Sinh khương | `sinh-khuong` | Show a familiar low-barrier specimen for the Near - Simple - Free concept |
| Cam thảo | `cam-thao` | Default live-demo specimen because the current rendered QA gate already validates this route |

## Physical format

For each specimen prepare one transparent jar, zip pouch, laminated herb card, or clearly labeled physical sample. The physical object must be safe to handle and clearly marked as an educational specimen.

Each label must contain:

- YHCT Connect - Smart Herb
- Vietnamese herb name
- Scientific name where available on the digital profile
- `Scan to learn - No app required`
- QR code
- `Educational use only - not for diagnosis or treatment`

Use QR first. NFC remains a roadmap item and is not required for the current competition MVP.

## QR target rule

During staging QA, QR codes may point to the protected Vercel preview using a temporary share token. These QA labels are temporary and must not be used as final competition print labels because the share token expires.

Final competition labels must be regenerated only after the public competition URL is frozen. The final QR must point directly to:

`https://<public-competition-domain>/smart-herb?herb=<slug>`

Do not print a permanent label against an expiring preview URL.

## Phone test checklist

Run this checklist on at least one Android phone and one iPhone if available. Record actual results only.

1. Open the native camera.
2. Scan the QR without installing a separate app.
3. Confirm the browser opens the intended herb profile.
4. Confirm the page can be read as Guest without login.
5. Confirm the selected herb matches the physical specimen.
6. Confirm Traditional Medicine learning content is visible.
7. Confirm the modern-evidence section is visible.
8. Open the PubMed source and verify the link resolves.
9. Confirm the safety disclaimer is visible without searching through menus.
10. Complete the micro-quiz.
11. Rotate the phone and return to portrait mode; confirm no unusable layout shift.
12. Test on mobile data and normal Wi-Fi.
13. Reload the direct deep link once.
14. Record loading or rendering failures exactly; do not infer success.

## Demo-table setup

Recommended table order from left to right:

1. Physical herb specimen.
2. QR label.
3. Student phone.
4. YHCT Connect Smart Herb profile.
5. PubMed source.

The judge should understand the product flow visually before any technical explanation.

## 45-60 second live demo

- 0-8 s: Hold the real specimen and state the learning problem.
- 8-18 s: Scan the QR with the phone camera.
- 18-32 s: Show identification + Traditional Medicine learning context.
- 32-43 s: Show modern evidence + PubMed traceability.
- 43-52 s: Show the safety boundary.
- 52-60 s: Show the micro-quiz and return to YHCT Connect academic community.

## Failure fallback

If venue Wi-Fi fails, use mobile data. If both networks fail, use the previously validated local/offline-safe demo data for the three MVP herbs, but do not claim that a live PubMed request succeeded.

If QR scanning fails, manually open the frozen deep link and record the QR failure for later correction. Do not replace a failed live step with a false claim that it worked.

## Print QA

Before final printing:

- QR module size must remain sharp and square.
- Minimum printed QR width: 30 mm; preferred: 35-40 mm.
- Maintain a clear white quiet zone around the QR.
- Do not place the QR over a photograph, gradient, or textured background.
- Test one physical print from 20-40 cm scanning distance before printing the set.
- The herb name must be readable without scanning.

## Release rule

This physical kit is a competition-demo layer. It does not authorize production merge. PR #21 remains Draft until the software test buffer is explicitly closed.