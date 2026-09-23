# HIU TMC Ecosystem — Visual QA checkpoint

Date: 2026-09-23

## Tested artifact
Branch: `ecosystem-hub-stage-a`

## Static render checks
- Desktop viewport: 1440 × 1000.
- Mobile viewport: 390 × 844.
- Horizontal overflow: **none** on both tested viewports.
- Map artwork: SVG loads successfully; intrinsic image is valid and complete.
- Home page: 4 map hotspots present.
- Home page: 4 application cards present.
- Home page: 4 learning-journey cards present.
- Required static routes return exported HTML:
  - `/`
  - `/ecosystem/study-os/`
  - `/ecosystem/ai-thiet-chan/`
  - `/ecosystem/trung-y-van/`
  - `/ecosystem/atlas/`

## UX correction made from QA
The original hero narrative overlapped the lower-left map district and its hotspot. The narrative was moved below the map, while the Quick Dock remains close to the map. This keeps all four districts unobstructed on desktop and mobile.

## Remaining visual acceptance
A live-browser smoke on `https://hiutmc.com` is still required after Cloudflare deployment because local static rendering does not validate public DNS, TLS, CDN headers or real production network behavior.
