#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${1:-https://yhct-hiu-4-0.vercel.app}"
echo "Health: $BASE_URL/api/health"
curl --fail --silent --show-error "$BASE_URL/api/health" | grep -q '"ok":true'
echo "Root: $BASE_URL/"
curl --fail --silent --show-error "$BASE_URL/" | grep -q 'YHCT HIU 4.0'
echo "Manifest: $BASE_URL/manifest.webmanifest"
curl --fail --silent --show-error "$BASE_URL/manifest.webmanifest" | grep -q 'YHCT HIU 4.0'
echo "PASS: web health gate"
