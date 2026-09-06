#!/usr/bin/env bash
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-drngovothiennhan/yhct-hiu-4-0}"
BRANCH="main"
VERSION="4.0.0-final.4"
git status --short
npm install --ignore-scripts --no-audit --no-fund
npm run build
git add .
git commit -m "release: YHCT HIU 4.0 Final ${VERSION} web-first" || echo "No changes to commit"
git push origin "$BRANCH"
vercel --prod --skip-domain
# Promote only after preview health/runtime gates pass.
